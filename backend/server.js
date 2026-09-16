const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Book = require("./models/Book");
const Review = require("./models/Review");
const User = require("./models/User");
const authenticateToken = require("./middleware/auth");

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
    if (!email || !emailPattern.test(email)) {
        return "Please enter a valid email address";
    }

    if (!password || password.length < 8) {
        return "Password must be at least 8 characters";
    }

    return null;
}

function createToken(user) {
    return require("jsonwebtoken").sign(
        { userId: user._id.toString(), email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function serializeReview(review) {
    return {
        id: review._id,
        rating: review.rating,
        comment: review.comment,
        user: {
            id: review.user._id,
            name: review.user.name
        },
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
    };
}

async function addRatingSummary(books, userId) {
    const bookList = Array.isArray(books) ? books : [books];
    const bookIds = bookList.map(book => book._id);
    const reviews = await Review.find({ book: { $in: bookIds } })
        .populate("user", "name")
        .lean();
    const reviewsByBook = new Map();

    reviews.forEach(review => {
        const bookId = review.book.toString();

        if (!reviewsByBook.has(bookId)) {
            reviewsByBook.set(bookId, []);
        }

        reviewsByBook.get(bookId).push(review);
    });

    return bookList.map(book => {
        const plainBook = typeof book.toObject === "function" ? book.toObject() : book;
        const bookReviews = reviewsByBook.get(book._id.toString()) || [];
        const totalRating = bookReviews.reduce((sum, review) => sum + review.rating, 0);
        const legacyRating = Math.max(0, Math.min(5, Number(book.rating) || 0));
        const currentReview = userId
            ? bookReviews.find(review => review.user._id.toString() === userId.toString())
            : null;

        return {
            ...plainBook,
            rating: bookReviews.length ? Number((totalRating / bookReviews.length).toFixed(1)) : legacyRating,
            ratingCount: bookReviews.length,
            currentUserReview: currentReview ? serializeReview(currentReview) : null
        };
    });
}

function validateReview(rating, comment) {
    const numericRating = Number(rating);
    const trimmedComment = String(comment || "").trim();

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return { message: "Rating must be a whole number from 1 to 5" };
    }

    if (!trimmedComment || trimmedComment.length > 1000) {
        return { message: "Comment must be between 1 and 1000 characters" };
    }

    return { rating: numericRating, comment: trimmedComment };
}

// Test route
app.get("/", (req, res) => {
    res.send("Book Recommendation API is running!");
});

// Register a new user.
app.post("/auth/signup", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const validationError = validateCredentials(email, password);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        if (!name) {
            return res.status(400).json({ message: "Please enter your name" });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        const user = await User.create({ name, email, password });

        res.status(201).json({
            message: "Account created successfully",
            token: createToken(user),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        res.status(500).json({ message: "Could not create your account" });
    }
});

// Log in an existing user.
app.post("/auth/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const validationError = validateCredentials(email, password);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const user = await User.findOne({ email }).select("+password");

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Email or password is incorrect" });
        }

        res.json({
            message: "Logged in successfully",
            token: createToken(user),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: "Could not log you in" });
    }
});

// Return the current user for an existing session.
app.get("/auth/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("name email createdAt");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Could not load your profile" });
    }
});

// Add a new book
app.post("/books", authenticateToken, async (req, res) => {
    try {
        const { title, author, category } = req.body;
        const book = new Book({
            title,
            author,
            category,
            createdBy: req.user.userId
        });
        const savedBook = await book.save();

        res.status(201).json(savedBook);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Return books created by the current user.
app.get("/auth/me/books", authenticateToken, async (req, res) => {
    try {
        const books = await Book.find({ createdBy: req.user.userId })
            .sort({ createdAt: -1 });

        res.json(await addRatingSummary(books, req.user.userId));
    } catch (error) {
        res.status(500).json({ message: "Could not load your books" });
    }
});

// Delete a book only when the current user owns it, including its reviews.
app.delete("/books/:id", authenticateToken, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).select("createdBy");

        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }

        if (!book.createdBy || book.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ message: "You can only delete books you added" });
        }

        await Review.deleteMany({ book: book._id });
        await book.deleteOne();

        res.json({ message: "Book and its reviews deleted" });
    } catch (error) {
        res.status(400).json({ message: "Could not delete book" });
    }
});

// Get all reviews for a book.
app.get("/books/:id/reviews", authenticateToken, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).select("_id");

        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }

        const reviews = await Review.find({ book: book._id })
            .populate("user", "name")
            .sort({ updatedAt: -1 });

        res.json(reviews.map(serializeReview));
    } catch (error) {
        res.status(400).json({ message: "Could not load reviews" });
    }
});

// Create or update the current user's review for a book.
app.put("/books/:id/review", authenticateToken, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).select("_id");

        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }

        const validatedReview = validateReview(req.body.rating, req.body.comment);

        if (validatedReview.message) {
            return res.status(400).json({ message: validatedReview.message });
        }

        const review = await Review.findOneAndUpdate(
            { book: book._id, user: req.user.userId },
            { $set: validatedReview },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).populate("user", "name");

        res.json(serializeReview(review));
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "You already reviewed this book. Please try again." });
        }

        res.status(400).json({ message: "Could not save your review" });
    }
});

// Delete only the current user's review for a book.
app.delete("/books/:id/review", authenticateToken, async (req, res) => {
    try {
        const deletedReview = await Review.findOneAndDelete({
            book: req.params.id,
            user: req.user.userId
        });

        if (!deletedReview) {
            return res.status(404).json({ message: "Your review was not found" });
        }

        res.json({ message: "Review deleted" });
    } catch (error) {
        res.status(400).json({ message: "Could not delete review" });
    }
});

// Search books
app.get("/books/search", authenticateToken, async (req, res) => {
    try {
        const query = req.query.q;

        const books = await Book.find({
            $or: [
                { title: { $regex: query, $options: "i" } },
                { author: { $regex: query, $options: "i" } },
                { category: { $regex: query, $options: "i" } }
            ]
        });

        res.json(await addRatingSummary(books, req.user.userId));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Get all books
app.get("/books", authenticateToken, async (req, res) => {
    try {
        const books = await Book.find();
        res.json(await addRatingSummary(books, req.user.userId));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");

        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });