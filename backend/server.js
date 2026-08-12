const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const Book = require("./models/Book");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
    res.send("Book Recommendation API is running!");
});

// Add a new book
app.post("/books", async (req, res) => {
    try {
        const book = new Book(req.body);
        const savedBook = await book.save();

        res.status(201).json(savedBook);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Search books
app.get("/books/search", async (req, res) => {
    try {
        const query = req.query.q;

        const books = await Book.find({
            $or: [
                { title: { $regex: query, $options: "i" } },
                { author: { $regex: query, $options: "i" } },
                { category: { $regex: query, $options: "i" } }
            ]
        });

        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Update book rating
app.put("/books/:id/rating", async (req, res) => {
    try {
        const { rating } = req.body;

        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { rating: rating },
            { new: true }
        );

        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }

        res.json(book);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
// Get all books
app.get("/books", async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
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