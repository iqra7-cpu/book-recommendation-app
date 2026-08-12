const API_URL = "http://localhost:5000";

// Display books on the page
function displayBooks(books) {
    const list = document.getElementById("bookList");
    list.innerHTML = "";

    if (books.length === 0) {
        list.innerHTML = "<p>No books found.</p>";
        return;
    }

    for (const book of books) {
        list.innerHTML += `
            <div class="book">
                <h3>${book.title}</h3>
                <p>Author: ${book.author}</p>
                <p>Category: ${book.category}</p>
                <p>Rating: ${book.rating}/5</p>
            </div>
        `;
    }
}


// Fetch ALL books from MongoDB through our backend
async function showBooks() {
    try {
        const response = await fetch(`${API_URL}/books`);
        const books = await response.json();

        if (!response.ok) {
            throw new Error(books.message || "Failed to fetch books");
        }

        displayBooks(books);
    } catch (error) {
        console.error(error);
        alert("Could not fetch books. Make sure the backend is running.");
    }
}


// Add a book to MongoDB through the backend
async function addBook() {
    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const category = document.getElementById("category").value.trim();
    const rating = Number(document.getElementById("rating").value);

    if (!title || !author || !category || !rating) {
        alert("Enter all details");
        return;
    }

    if (rating < 1 || rating > 5) {
        alert("Rating must be 1 to 5");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/books`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title,
                author,
                category,
                rating
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to add book");
        }

        alert("Book Added Successfully!");

        document.getElementById("title").value = "";
        document.getElementById("author").value = "";
        document.getElementById("category").value = "";
        document.getElementById("rating").value = "";

        // Refresh books from MongoDB
        showBooks();

    } catch (error) {
        console.error(error);
        alert("Could not add book. Make sure the backend is running.");
    }
}


// Search books using the backend
async function searchBook() {
    const search = document.getElementById("search").value.trim();

    if (!search) {
        showBooks();
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/books/search?q=${encodeURIComponent(search)}`
        );

        const books = await response.json();

        if (!response.ok) {
            throw new Error(books.message || "Search failed");
        }

        displayBooks(books);

    } catch (error) {
        console.error(error);
        alert("Search failed. Make sure the backend is running.");
    }
}