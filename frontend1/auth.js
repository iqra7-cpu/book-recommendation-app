const API_BASE_URL = "http://localhost:5000";
const TOKEN_KEY = "bookbloom_token";
const USER_KEY = "bookbloom_user";

const form = document.getElementById("authForm");
const message = document.getElementById("authMessage");
const submitButton = form.querySelector("button[type=submit]");
const authMode = document.body.dataset.authMode;

if (localStorage.getItem(TOKEN_KEY)) {
    window.location.replace("index.html");
}

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = `auth-message ${type}`.trim();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function storeSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (authMode === "signup" && !name) {
        showMessage("Please enter your name");
        return;
    }

    if (!isValidEmail(email)) {
        showMessage("Please enter a valid email address");
        return;
    }

    if (password.length < 8) {
        showMessage("Password must be at least 8 characters");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = authMode === "signup" ? "Creating account..." : "Signing in...";

    try {
        const response = await fetch(`${API_BASE_URL}/auth/${authMode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || "Something went wrong. Please try again.");
        }

        storeSession(data);
        window.location.replace("index.html");
    } catch (error) {
        showMessage(error.message);
        submitButton.disabled = false;
        submitButton.textContent = authMode === "signup" ? "Create account" : "Sign in";
    }
});
