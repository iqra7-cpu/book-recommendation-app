const API_BASE_URL = "http://localhost:5000";

let books = [];
let selectedCategory = "All";
let searchRequestId = 0;


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
    const response = await fetch(`${API_BASE_URL}/books`);

    if (!response.ok) {
        throw new Error(`Could not fetch books (${response.status})`);
    }

    return await response.json();
}


// SEARCH THROUGH THE BACKEND
async function searchBooksFromAPI(query) {
    const response = await fetch(
        `${API_BASE_URL}/books/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        throw new Error(`Search failed (${response.status})`);
    }

    return await response.json();
}


// ADD BOOK TO MONGODB
async function addBookToAPI(book) {
    const response = await fetch(`${API_BASE_URL}/books`, {
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

        const stars =
            "★".repeat(rating) +
            "☆".repeat(5 - rating);


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
                        ${rating}/5
                    </span>

                </div>

            </div>
        `;

        bookList.appendChild(card);

    });
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

        const rating =
            Number(document.getElementById("rating").value);


        const newBook = {
            title,
            author,
            category,
            rating
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
