document.addEventListener("DOMContentLoaded", function(){
    if (!ApiClient.getAuthToken()) {
        window.location.href = "index.html";
        return;
    }

    // Prices for each item
    const prices = {
        cake: 211.00,
        cookie: 36.30,
        pudding: 20.00
    };

    //paths to images
    const images = {
        cake: "logo_and_product/Scake.jpg",
        cookie: "logo_and_product/Cookies.jpg",
        pudding: "logo_and_product/pudding.jpg"
    };

    let cart = JSON.parse(localStorage.getItem("cart")) || [];

    const itemsContainer = document.querySelector(".items");
    const totalElement = document.getElementById("total");

    itemsContainer.innerHTML = "";

    let total = 0;

    // calculate total
    cart.forEach(item => {
        total += item.price * item.qty;

        itemsContainer.innerHTML += `
            <div class="item">
                <img src="${images[item.id]}" alt="${item.name}">
                <p>${item.name}</p>
                <p>Quantity: ${item.qty}</p>
            </div>
        `;
    });

    totalElement.innerText = total.toFixed(2);

});

function goBack() {
    window.location.href = "menu.html";
}


async function confirmOrder() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];

    if (cartEmpty()) {
        alert("Your cart is empty!");
        return;
    }

    try {
        await ApiClient.request("/api/order", "POST", { items: cart });
        alert("Order Confirmed! Thank you for ordering Sweet Royals!");
        localStorage.removeItem("cart");
        window.location.href = "menu.html";
    } catch (err) {
        if ((err.message || "").toLowerCase().includes("unauthorized")) {
            ApiClient.clearAuthToken();
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("user");
            window.location.href = "index.html";
            return;
        }
        alert(err.message || "Failed to confirm order.");
    }
}


function cartEmpty() {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    return cart.length === 0;
}
