document.addEventListener("DOMContentLoaded", async function() {

    try {
        const data = await ApiClient.request("/api/me", "GET");
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
    } catch (_) {
        ApiClient.clearAuthToken();
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("user");
        window.location.href = "index.html";
        return;
    }

    const prices = {
        cake: 211.00,
        cookie: 36.30,
        pudding: 20.00
    };

    const names = {
        cake: "Strawberry Cake",
        cookie: "Cookie",
        pudding: "Pudding"
    };

    window.logout = async function() {
        try {
            await ApiClient.request("/api/logout", "POST");
        } catch (_) {}
        ApiClient.clearAuthToken();
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("user");
        localStorage.removeItem("cart");
        window.location.href = "index.html";
    };

    window.changeQty = function(id, delta) {
        const element = document.getElementById(id);
        let current = parseInt(element.innerText, 10) || 0;
        current += delta;
        if (current < 0) current = 0;
        if (current > 99) current = 99;
        element.innerText = current;
        updateCart(id, current);
    };

    function updateCart(id, qty) {
        let cart = JSON.parse(localStorage.getItem("cart")) || [];
        const price = prices[id];
        const name = names[id];
        const existing = cart.find(item => item.id === id);

        if (qty === 0) {
            cart = cart.filter(item => item.id !== id);
        } else if (existing) {
            existing.qty = qty;
        } else {
            cart.push({ id, name, price, qty });
        }

        localStorage.setItem("cart", JSON.stringify(cart));
    }

    window.checkout = function() {
        window.location.href = "checkout.html";
    };

    const contactBtn = document.querySelector(".contact-btn");
    if (contactBtn) {
        contactBtn.addEventListener("click", function() {
            window.location.href = "contact.html";
        });
    }

    window.profileClick = function() {
        window.location.href = "profile.html";
    };
});
