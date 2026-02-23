async function register() {
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const address = document.getElementById("regAddress").value.trim();

    if (!username || !email || !password || !address) {
        alert("Please fill in all fields.");
        return;
    }

    if (username.length < 3 || username.length > 30) {
        alert("Username must be 3-30 characters.");
        return;
    }

    if (password.length < 8 || password.length > 64) {
        alert("Password must be 8-64 characters.");
        return;
    }

    if (address.length < 5 || address.length > 200) {
        alert("Address must be 5-200 characters.");
        return;
    }

    try {
        await ApiClient.request("/api/register", "POST", {
            username,
            email,
            password,
            address
        });

        alert("Registration Successful!");
        setTimeout(function() {
            window.location.href = "index.html";
        }, 800);
    } catch (err) {
        alert(err.message || "Registration failed.");
    }
}

function goBack() {
    window.location.href = "index.html";
}
