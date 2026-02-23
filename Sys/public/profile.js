window.onload = async function() {
    try {
        const data = await ApiClient.request("/api/me", "GET");
        const user = data.user;
        localStorage.setItem("user", JSON.stringify(user));
        document.getElementById("displayName").innerText = user.name;
        document.getElementById("displayNumber").innerText = user.number;
    } catch (_) {
        ApiClient.clearAuthToken();
        localStorage.removeItem("user");
        localStorage.removeItem("loggedIn");
        window.location.href = "index.html";
    }
};

function openModal() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    document.getElementById("nameInput").value = user.name || "";
    document.getElementById("numberInput").value = user.number || "";
    document.getElementById("locationInput").value = user.location || "";
    document.getElementById("editModal").style.display = "flex";
}

async function saveProfile() {
    const name = document.getElementById("nameInput").value.trim();
    const number = document.getElementById("numberInput").value.trim();
    const location = document.getElementById("locationInput").value.trim();

    if (name.length < 2 || name.length > 60) {
        alert("Name must be 2-60 characters.");
        return;
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(number)) {
        alert("Mobile number is invalid.");
        return;
    }
    if (location.length < 3 || location.length > 150) {
        alert("Location must be 3-150 characters.");
        return;
    }

    try {
        const data = await ApiClient.request("/api/profile", "PUT", { name, number, location });
        localStorage.setItem("user", JSON.stringify(data.user));
        document.getElementById("displayName").innerText = data.user.name;
        document.getElementById("displayNumber").innerText = data.user.number;
        document.getElementById("editModal").style.display = "none";
        alert("Profile Updated Successfully!");
    } catch (err) {
        alert(err.message || "Failed to update profile.");
    }
}

function logout() {
    ApiClient.request("/api/logout", "POST").catch(function() {});
    ApiClient.clearAuthToken();
    localStorage.removeItem("user");
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("cart");
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", function() {
    const menuBtn = document.querySelector(".menu-btn");
    const contactBtn = document.querySelector(".contact-btn");

    if (menuBtn) {
        menuBtn.addEventListener("click", function() {
            window.location.href = "menu.html";
        });
    }

    if (contactBtn) {
        contactBtn.addEventListener("click", function() {
            window.location.href = "contact.html";
        });
    }
});
