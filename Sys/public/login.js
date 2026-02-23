async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    errorMsg.textContent = "";

    if (!username || !password) {
        errorMsg.textContent = "Please fill in all fields.";
        return;
    }

    if (username.length < 3 || username.length > 30) {
        errorMsg.textContent = "Username must be 3-30 characters.";
        return;
    }

    if (password.length < 8 || password.length > 64) {
        errorMsg.textContent = "Password must be 8-64 characters.";
        return;
    }

    try {
        const data = await ApiClient.request("/api/login", "POST", { username, password });
        ApiClient.setAuthToken(data.token);
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "menu.html";
    } catch (err) {
        errorMsg.textContent = err.message || "Invalid username or password.";
    }
}
