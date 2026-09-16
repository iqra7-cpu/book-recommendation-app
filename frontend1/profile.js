const API_BASE_URL = "http://localhost:5000";
const TOKEN_KEY = "bookbloom_token";
const USER_KEY = "bookbloom_user";

const token = localStorage.getItem(TOKEN_KEY);
const profileMessage = document.getElementById("profileMessage");

function redirectToLogin() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace("login.html");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getInitials(name) {
    return String(name || "Reader")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
}

function formatMemberSince(date) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "BookBloom reader";
    }

    return parsedDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric"
    });
}

async function loadProfile() {
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok || !data.user) {
            throw new Error(data.message || "Could not load your profile");
        }

        const user = data.user;
        document.getElementById("profileInitials").textContent = getInitials(user.name);
        document.getElementById("profileName").textContent = user.name;
        document.getElementById("profileEmail").textContent = user.email;
        document.getElementById("profileCreatedAt").textContent = formatMemberSince(user.createdAt);
        localStorage.setItem(USER_KEY, JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email
        }));
        await loadMyBooks();
    } catch (error) {
        profileMessage.textContent = error.message;
    }
}

async function loadMyBooks() {
    const response = await fetch(`${API_BASE_URL}/auth/me/books`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        redirectToLogin();
        return;
    }

    if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.message || "Could not load your books");
    }

    renderMyBooks(data);
}

function renderMyBooks(books) {
    const list = document.getElementById("myBooksList");
    document.getElementById("myBooksCount").textContent = `${books.length} book${books.length === 1 ? "" : "s"}`;

    if (books.length === 0) {
        list.innerHTML = `<p class="my-books-empty">You haven't added any books yet.</p>`;
        return;
    }

    list.innerHTML = books.map(book => {
        const rating = Number(book.rating) || 0;
        const ratingCount = Number(book.ratingCount) || 0;
        const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

        return `
            <article class="my-book-item">
                <div class="my-book-details">
                    <span class="my-book-category">${escapeHtml(book.category)}</span>
                    <h4>${escapeHtml(book.title)}</h4>
                    <p>by ${escapeHtml(book.author)}</p>
                    <div class="my-book-rating">
                        <span>${stars}</span>
                        <small>${rating ? `${rating}/5` : "No rating"} · ${ratingCount} rating${ratingCount === 1 ? "" : "s"}</small>
                    </div>
                </div>
                <button class="delete-book-button" type="button" data-book-id="${escapeHtml(book._id)}">Delete book</button>
            </article>
        `;
    }).join("");

    list.querySelectorAll(".delete-book-button").forEach(button => {
        button.addEventListener("click", () => deleteBook(button.dataset.bookId));
    });
}

async function deleteBook(bookId) {
    if (!window.confirm("Delete this book and all of its reviews?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/books/${encodeURIComponent(bookId)}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Could not delete book");
        }

        await loadMyBooks();
        profileMessage.textContent = "Book deleted";
        profileMessage.className = "profile-message success";
    } catch (error) {
        profileMessage.textContent = error.message;
        profileMessage.className = "profile-message";
    }
}

document
    .getElementById("logoutButton")
    .addEventListener("click", redirectToLogin);

loadProfile();
