SecurityUtils.ensurePageAuth("index.html");

var CART_STORAGE_KEY = "cart";

function getCartItems() {
  try {
    var raw = localStorage.getItem(CART_STORAGE_KEY) || "[]";
    var parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [];
  } catch (error) {
    return [];
  }
}

function showPeso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function loadCheckoutItems() {
  var items = getCartItems();
  var itemsBox = document.getElementById("checkoutItems");
  var summaryBox = document.getElementById("orderSummary");
  var totalBox = document.getElementById("totalAmount");
  var total = 0;

  if (!itemsBox || !summaryBox || !totalBox) {
    return;
  }

  if (items.length === 0) {
    itemsBox.innerHTML = `
      <div class="sr-empty-state">
        <p>Your cart is empty. Add menu items first.</p>
      </div>
    `;
    summaryBox.innerHTML = "";
    totalBox.textContent = showPeso(0);
    return;
  }

  var itemsHtml = "";
  var summaryHtml = "";

  items.forEach(function (item) {
    var subtotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
    var image = SecurityUtils.sanitizeUrl(item.image) || "logo_and_product/logo.png";

    total += subtotal;

    itemsHtml += `
      <article class="sr-cart-item">
        <img src="${SecurityUtils.escapeAttribute(image)}" alt="${SecurityUtils.escapeAttribute(item.name)}">
        <div>
          <h3 class="sr-heading-md" style="font-size: 1.1rem;">${SecurityUtils.escapeHtml(item.name)}</h3>
          <p class="sr-text-muted">${SecurityUtils.escapeHtml(item.category || "Bakery item")}</p>
          <p class="sr-text-muted">Quantity: ${Number(item.qty) || 0}</p>
        </div>
        <strong>${showPeso(subtotal)}</strong>
      </article>
    `;

    summaryHtml += `
      <article class="sr-summary-card">
        <div class="sr-inline-between">
          <span>${SecurityUtils.escapeHtml(item.name)}</span>
          <span>${Number(item.qty) || 0} x ${showPeso(item.price)}</span>
        </div>
      </article>
    `;
  });

  itemsBox.innerHTML = itemsHtml;
  summaryBox.innerHTML = summaryHtml;
  totalBox.textContent = showPeso(total);
}

async function sendOrder() {
  var items = getCartItems();
  var confirmButton = document.getElementById("confirmOrderBtn");
  var specialRequestInput = document.getElementById("specialRequest");
  var specialRequest = specialRequestInput ? String(specialRequestInput.value || "").trim() : "";
  var checkAnswer;

  if (items.length === 0) {
    Notify.warning("Your cart is empty.");
    return;
  }

  if (specialRequest.length > 300) {
    Notify.warning("Special request must be 300 characters or fewer.");
    return;
  }

  checkAnswer = await Notify.confirm("Confirm this order and send it to Sweet Royals?", "Confirm Order");

  if (!checkAnswer) {
    return;
  }

  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.textContent = "Confirming...";
  }

  try {
    var response = await ApiClient.request("/api/order", "POST", {
      items: items,
      specialRequest: specialRequest,
    });

    localStorage.removeItem(CART_STORAGE_KEY);
    Notify.success("Order confirmed.");
    Notify.push("Sweet Royals Order Confirmed", {
      body: "Your total is " + showPeso(response.total) + ".",
    });
    window.location.href = "menu.html";
  } catch (error) {
    Notify.error(SecurityUtils.getSafeErrorMessage(error));

    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm Order";
    }
  }
}

function goToCustomOrder() {
  var subject = encodeURIComponent("Custom Order Request");
  var body = encodeURIComponent("Hello Sweet Royals, I would like to ask about a custom order.");
  window.location.href = "mailto:hashisabakery@gmail.com?subject=" + subject + "&body=" + body;
}

document.addEventListener("DOMContentLoaded", function () {
  loadCheckoutItems();

  var backButton = document.getElementById("checkoutBackBtn");
  var menuButton = document.getElementById("backToMenuBtn");
  var contactButton = document.querySelector(".contact-btn");
  var customOrderButton = document.getElementById("customOrderBtn");
  var confirmButton = document.getElementById("confirmOrderBtn");

  if (backButton) {
    backButton.addEventListener("click", function () {
      window.location.href = "menu.html";
    });
  }

  if (menuButton) {
    menuButton.addEventListener("click", function () {
      window.location.href = "menu.html";
    });
  }

  if (contactButton) {
    contactButton.addEventListener("click", function () {
      window.location.href = "contact.html";
    });
  }

  if (customOrderButton) {
    customOrderButton.addEventListener("click", goToCustomOrder);
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", sendOrder);
  }
});
