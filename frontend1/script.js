const API_BASE_URL = "http://localhost:5000";
const TOKEN_KEY = "bookbloom_token";
const USER_KEY = "bookbloom_user";

if (!localStorage.getItem(TOKEN_KEY)) {
    window.location.replace("login.html");
}

let books = [];
let selectedCategory = "All";
let searchRequestId = 0;
let selectedReviewBook = null;
let selectedReviewRating = 0;


function redirectToLogin() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace("login.html");
}


async function authenticatedFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${localStorage.getItem(TOKEN_KEY)}`);

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Your session has expired");
    }

    return response;
}


// ESCAPE TEXT BEFORE PUTTING DATABASE VALUES INTO HTML
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// GET ALL BOOKS FROM MONGODB
async function fetchBooks() {
    const response = await authenticatedFetch(`${API_BASE_URL}/books`);

    if (!response.ok) {
        throw new Error(`Could not fetch books (${response.status})`);
    }

    return await response.json();
}


// SEARCH THROUGH THE BACKEND
async function searchBooksFromAPI(query) {
    const response = await authenticatedFetch(
        `${API_BASE_URL}/books/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
    }

    return await response.json();
}


// ADD BOOK TO MONGODB
async function addBookToAPI(book) {
    const response = await authenticatedFetch(`${API_BASE_URL}/books`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(book)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Could not add book (${response.status})`);
    }

    return await response.json();
}


async function fetchReviews(bookId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/books/${bookId}/reviews`);

    if (!response.ok) {
        throw new Error(`Could not fetch reviews (${response.status})`);
    }

    return await response.json();
}


async function saveReview(bookId, review) {
    const response = await authenticatedFetch(`${API_BASE_URL}/books/${bookId}/review`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(review)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Could not save review (${response.status})`);
    }

    return data;
}


async function deleteReview(bookId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/books/${bookId}/review`, {
        method: "DELETE"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Could not delete review (${response.status})`);
    }

    return data;
}


// DISPLAY BOOKS
function displayBooks(list) {

    const bookList = document.getElementById("bookList");

    bookList.innerHTML = "";

    if (list.length === 0) {

        bookList.innerHTML = `
            <div class="empty">
                No books found ✦
            </div>
        `;

        return;
    }


    list.forEach(book => {

        const card = document.createElement("div");

        card.className = "book-card";

        const rating = Math.max(0, Math.min(5, Number(book.rating) || 0));
        const visibleStars = Math.round(rating);
        const ratingCount = Number(book.ratingCount) || 0;

        const stars =
            "★".repeat(visibleStars) +
            "☆".repeat(5 - visibleStars);


        card.innerHTML = `

            <div class="book-image">
                📖
            </div>

            <div class="book-details">

                <span class="book-category">
                    ${escapeHtml(book.category)}
                </span>

                <h3 title="${escapeHtml(book.title)}">
                    ${escapeHtml(book.title)}
                </h3>

                <p class="book-author">
                    by ${escapeHtml(book.author)}
                </p>

                <div class="book-rating">

                    <div class="stars">
                        ${stars}
                    </div>

                    <span class="rating-number">
                        ${rating ? `${rating}/5` : "No rating"}
                    </span>

                </div>

                <button class="review-book-button" type="button">${ratingCount ? `${ratingCount} review${ratingCount === 1 ? "" : "s"}` : "Be the first to review"}</button>

            </div>
        `;

        card.querySelector(".review-book-button").addEventListener("click", () => openReviewModal(book));

        bookList.appendChild(card);

    });
}


function setReviewMessage(text, type = "") {
    const message = document.getElementById("reviewMessage");
    message.textContent = text;
    message.className = `review-message ${type}`.trim();
}


function renderStarPicker(selectedRating) {
    const picker = document.getElementById("starPicker");
    picker.innerHTML = "";

    for (let rating = 1; rating <= 5; rating += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `star-choice${rating <= selectedRating ? " selected" : ""}`;
        button.textContent = "★";
        button.setAttribute("aria-label", `${rating} star${rating === 1 ? "" : "s"}`);
        button.setAttribute("aria-checked", String(rating === selectedRating));
        button.setAttribute("role", "radio");
        button.addEventListener("click", () => {
            selectedReviewRating = rating;
            renderStarPicker(selectedReviewRating);
        });
        picker.appendChild(button);
    }
}


function renderReviews(reviews) {
    const reviewsList = document.getElementById("reviewsList");
    const currentUser = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    document.getElementById("reviewListCount").textContent = `${reviews.length} review${reviews.length === 1 ? "" : "s"}`;

    if (reviews.length === 0) {
        reviewsList.innerHTML = `<p class="reviews-empty">No reviews yet. Share the first thought.</p>`;
        return;
    }

    reviewsList.innerHTML = reviews.map(review => {
        const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
        const date = new Date(review.updatedAt || review.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

        return `
            <article class="review-item">
                <div class="review-item-top">
                    <strong>${escapeHtml(review.user.name)}</strong>
                    <div class="review-item-actions">
                        <span>${escapeHtml(date)}</span>
                        ${currentUser && String(review.user.id) === String(currentUser.id)
                            ? `<button class="delete-review-button" type="button" data-review-id="${escapeHtml(review.id)}">Delete</button>`
                            : ""}
                    </div>
                </div>
                <div class="review-item-stars">${stars}</div>
                <p>${escapeHtml(review.comment)}</p>
            </article>
        `;
    }).join("");

    reviewsList.querySelectorAll(".delete-review-button").forEach(button => {
        button.addEventListener("click", handleDeleteReview);
    });
}


async function handleDeleteReview() {
    if (!selectedReviewBook || !window.confirm("Delete your review for this book?")) {
        return;
    }

    const button = this;
    button.disabled = true;

    try {
        await deleteReview(selectedReviewBook._id);
        books = await fetchBooks();
        selectedReviewBook = books.find(book => book._id === selectedReviewBook._id) || selectedReviewBook;
        selectedReviewRating = 0;
        document.getElementById("reviewComment").value = "";
        renderStarPicker(0);
        renderReviewSummary(selectedReviewBook);
        renderReviews(await fetchReviews(selectedReviewBook._id));
        setReviewMessage("Review deleted", "success");
    } catch (error) {
        setReviewMessage(error.message);
        button.disabled = false;
    }
}


function renderReviewSummary(book) {
    const rating = Math.max(0, Math.min(5, Number(book.rating) || 0));
    const ratingCount = Number(book.ratingCount) || 0;
    const visibleStars = Math.round(rating);

    document.getElementById("reviewAverage").textContent = rating ? `${rating}/5` : "—";
    document.getElementById("reviewAverageStars").textContent =
        "★".repeat(visibleStars) + "☆".repeat(5 - visibleStars);
    document.getElementById("reviewCount").textContent = ratingCount
        ? `${ratingCount} user rating${ratingCount === 1 ? "" : "s"}`
        : "No user ratings yet";
}


async function openReviewModal(book) {
    selectedReviewBook = book;
    selectedReviewRating = Number(book.currentUserReview?.rating) || 0;
    document.getElementById("reviewBookTitle").textContent = book.title;
    document.getElementById("reviewBookAuthor").textContent = `by ${book.author}`;
    renderReviewSummary(book);
    document.getElementById("reviewComment").value = book.currentUserReview?.comment || "";
    document.getElementById("reviewModal").hidden = false;
    document.body.classList.add("modal-open");
    setReviewMessage("");
    renderStarPicker(selectedReviewRating);

    try {
        const reviews = await fetchReviews(book._id);
        renderReviews(reviews);
    } catch (error) {
        document.getElementById("reviewsList").innerHTML = `<p class="reviews-empty">${escapeHtml(error.message)}</p>`;
    }
}


function closeReviewModal() {
    document.getElementById("reviewModal").hidden = true;
    document.body.classList.remove("modal-open");
    selectedReviewBook = null;
}


// APPLY THE CATEGORY FILTER
function applyCategoryFilter(list) {
    if (selectedCategory === "All") {
        return list;
    }

    return list.filter(book =>
        String(book.category).toLowerCase() === selectedCategory.toLowerCase()
    );
}


// SEARCH
async function searchBooks() {

    const value =
        document
            .getElementById("search")
            .value
            .trim();

    const requestId = ++searchRequestId;

    try {
        let results;

        if (value === "") {
            results = await fetchBooks();
        } else {
            results = await searchBooksFromAPI(value);
        }

        // Ignore an older request if the user typed again quickly.
        if (requestId !== searchRequestId) {
            return;
        }

        const filtered = applyCategoryFilter(results);

        displayBooks(filtered);

    } catch (error) {
        console.error(error);

        if (requestId === searchRequestId) {
            document.getElementById("bookList").innerHTML = `
                <div class="empty">
                    Unable to load books. Please make sure the backend is running.
                </div>
            `;
        }
    }
}


// FILTER
function filterBooks(category, button) {

    selectedCategory = category;

    document
        .querySelectorAll(".filter")
        .forEach(btn => {
            btn.classList.remove("active");
        });

    button.classList.add("active");

    searchBooks();
}


// ADD BOOK
document
    .getElementById("bookForm")
    .addEventListener("submit", async function(e) {

        e.preventDefault();

        const title =
            document.getElementById("title").value.trim();

        const author =
            document.getElementById("author").value.trim();

        const category =
            document.getElementById("category").value;

        const newBook = {
            title,
            author,
            category
        };


        try {
            // THIS IS THE IMPORTANT PART:
            // Save the book in MongoDB through POST /books.
            const savedBook = await addBookToAPI(newBook);

            // Update the local display with the document returned by MongoDB.
            books.unshift(savedBook);

            // Re-fetch so the UI always matches the database.
            books = await fetchBooks();

            const filtered = applyCategoryFilter(books);

            displayBooks(filtered);

            this.reset();

        } catch (error) {
            console.error("Add book error:", error);

            alert(
                "Book could not be saved. Make sure the backend is running on port 5000."
            );
        }
    });


document
    .getElementById("reviewForm")
    .addEventListener("submit", async function(event) {
        event.preventDefault();

        const comment = document.getElementById("reviewComment").value.trim();

        if (!selectedReviewBook || selectedReviewRating < 1 || selectedReviewRating > 5) {
            setReviewMessage("Choose a rating from 1 to 5 stars");
            return;
        }

        if (!comment || comment.length > 1000) {
            setReviewMessage("Your review must be between 1 and 1000 characters");
            return;
        }

        const submitButton = document.getElementById("reviewSubmit");
        submitButton.disabled = true;
        setReviewMessage("");

        try {
            await saveReview(selectedReviewBook._id, {
                rating: selectedReviewRating,
                comment
            });
            books = await fetchBooks();
            displayBooks(applyCategoryFilter(books));
            selectedReviewBook = books.find(book => book._id === selectedReviewBook._id) || selectedReviewBook;
            renderReviewSummary(selectedReviewBook);
            const reviews = await fetchReviews(selectedReviewBook._id);
            renderReviews(reviews);
            setReviewMessage("Review saved", "success");
        } catch (error) {
            setReviewMessage(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });


document
    .getElementById("closeReviewButton")
    .addEventListener("click", closeReviewModal);

document
    .querySelector("[data-close-review]")
    .addEventListener("click", closeReviewModal);

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("reviewModal").hidden) {
        closeReviewModal();
    }
});


document
    .getElementById("logoutButton")
    .addEventListener("click", redirectToLogin);


// INITIAL LOAD
async function initializeBooks() {

    try {
        books = await fetchBooks();

        displayBooks(applyCategoryFilter(books));

    } catch (error) {
        console.error("Initial book load error:", error);

        document.getElementById("bookList").innerHTML = `
            <div class="empty">
                Unable to connect to the book database.
                Please start the backend on port 5000.
            </div>
        `;
    }
}


initializeBooks();
