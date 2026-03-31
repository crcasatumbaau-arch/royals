SecurityUtils.ensurePageAuth("index.html");

const CART_KEY = "cart";
const FEEDBACK_KEY = "sr-feedback";

let currentUser = null;
let productsCache = [];
let ordersCache = [];
let activeCategory = "All";
let activeSearch = "";
let refreshTimer = null;

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCartQuantity(productId) {
  const item = readCart().find((entry) => String(entry.id) === String(productId));
  return item ? Number(item.qty) || 0 : 0;
}

function setCartQuantity(product, qty) {
  const cart = readCart();
  const nextQty = Math.max(0, Math.min(99, Number(qty) || 0));
  const index = cart.findIndex((entry) => String(entry.id) === String(product.id));

  if (nextQty === 0) {
    if (index >= 0) {
      cart.splice(index, 1);
    }
    writeCart(cart);
    return 0;
  }

  const nextItem = {
    id: product.id,
    name: product.name,
    price: Number(product.price) || 0,
    qty: nextQty,
    image: product.image || "",
    category: product.category || "",
  };

  if (index >= 0) {
    cart[index] = nextItem;
  } else {
    cart.push(nextItem);
  }

  writeCart(cart);
  return nextQty;
}

function getFilteredProducts() {
  return productsCache.filter((product) => {
    const matchesCategory = activeCategory === "All" || (product.category || "Uncategorized") === activeCategory;
    const haystack = normalizeSearchText(`${product.name || ""} ${product.description || ""} ${product.category || ""}`);
    const matchesSearch = !activeSearch || haystack.includes(activeSearch);
    return matchesCategory && matchesSearch;
  });
}

function renderCategoryFilters() {
  const filters = document.getElementById("categoryFilters");
  if (!filters) {
    return;
  }

  const categories = ["All", ...new Set(productsCache.map((product) => product.category || "Uncategorized"))];

  filters.innerHTML = categories.map((category) => `
    <button
      class="sr-chip ${category === activeCategory ? "is-active" : ""}"
      type="button"
      data-category="${SecurityUtils.escapeAttribute(category)}">
      ${SecurityUtils.escapeHtml(category)}
    </button>
  `).join("");
}

function renderProducts() {
  const menuGrid = document.getElementById("menuGrid");
  const badge = document.getElementById("menuStatusBadge");
  const products = getFilteredProducts();

  if (badge) {
    badge.textContent = `${products.length} item${products.length === 1 ? "" : "s"} visible`;
  }

  if (!menuGrid) {
    return;
  }

  if (!products.length) {
    menuGrid.innerHTML = `
      <div class="sr-empty-state sr-card" style="padding: 2rem;">
        <h3 class="sr-heading-md">No products matched</h3>
        <p class="sr-text-muted">Try another search term or category filter.</p>
      </div>
    `;
    return;
  }

  menuGrid.innerHTML = products.map((product) => {
    const availableQty = Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 99;
    const isSoldOut = availableQty <= 0;
    const qty = getCartQuantity(product.id);
    const image = SecurityUtils.sanitizeUrl(product.image) || "logo_and_product/logo.png";

    return `
      <article class="sr-card sr-product-card" data-product-id="${SecurityUtils.escapeAttribute(product.id)}">
        <div class="sr-product-media">
          <img src="${SecurityUtils.escapeAttribute(image)}" alt="${SecurityUtils.escapeAttribute(product.name)}">
          <span class="sr-stock-pill ${isSoldOut ? "is-soldout" : ""}">
            ${isSoldOut ? "Sold Out" : `${availableQty} left`}
          </span>
        </div>
        <div class="sr-product-body">
          <div class="sr-product-top">
            <h3 class="sr-product-name">${SecurityUtils.escapeHtml(product.name)}</h3>
            <span class="sr-price">${formatPrice(product.price)}</span>
          </div>
          <div class="sr-product-meta">
            <span>${SecurityUtils.escapeHtml(product.category || "Uncategorized")}</span>
            <span>${qty} in cart</span>
          </div>
          <p class="sr-text-muted">${SecurityUtils.escapeHtml(product.description || "Freshly prepared for your order.")}</p>
          <div class="sr-product-actions">
            <div class="sr-counter">
              <button type="button" data-action="decrease" data-id="${SecurityUtils.escapeAttribute(product.id)}" ${isSoldOut ? "disabled" : ""}>-</button>
              <span class="sr-counter-value">${qty}</span>
              <button type="button" data-action="increase" data-id="${SecurityUtils.escapeAttribute(product.id)}" ${isSoldOut ? "disabled" : ""}>+</button>
            </div>
            <button class="sr-btn ${isSoldOut ? "sr-btn-secondary" : ""}" type="button" data-action="add" data-id="${SecurityUtils.escapeAttribute(product.id)}" ${isSoldOut ? "disabled" : ""}>
              ${isSoldOut ? "Unavailable" : "Add to Cart"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderOrders() {
  const ordersContainer = document.getElementById("customerOrders");
  const kpiOrders = document.getElementById("kpiOrders");

  if (kpiOrders) {
    kpiOrders.textContent = String(ordersCache.length);
  }

  if (!ordersContainer) {
    return;
  }

  if (!ordersCache.length) {
    ordersContainer.innerHTML = `
      <div class="sr-empty-state">
        <p>No orders yet. Your confirmed orders will appear here.</p>
      </div>
    `;
    return;
  }

  ordersContainer.innerHTML = ordersCache.map((order) => `
    <article class="sr-order-card">
      <div class="sr-order-head">
        <div>
          <strong>${SecurityUtils.escapeHtml(order.customerName || currentUser?.name || currentUser?.username || "Customer")}</strong>
          <div class="sr-text-muted">${formatDate(order.createdAt)}</div>
          <div class="sr-text-muted">${Number(order.itemCount) || 0} item${Number(order.itemCount) === 1 ? "" : "s"} • ${formatPrice(order.total)}</div>
        </div>
        <span class="sr-status ${SecurityUtils.escapeAttribute(order.status || "confirmed")}">${SecurityUtils.escapeHtml(order.status || "confirmed")}</span>
      </div>
      ${(order.status || "").toLowerCase() === "cancelled"
        ? ""
        : `<div style="margin-top: 0.9rem;">
            <button class="sr-btn sr-btn-danger" type="button" data-action="cancel-order" data-id="${SecurityUtils.escapeAttribute(order.id)}">Cancel Order</button>
          </div>`}
    </article>
  `).join("");
}

function renderFeedbackPreview() {
  const preview = document.getElementById("feedbackPreview");
  if (!preview) {
    return;
  }

  const items = Feedback.getStoredFeedback().slice(-3).reverse();

  if (!items.length) {
    preview.innerHTML = `
      <div class="sr-empty-state">
        <p>No feedback shared yet. Use the floating feedback button to add one.</p>
      </div>
    `;
    return;
  }

  preview.innerHTML = items.map((item) => `
    <article class="sr-feedback-card">
      <strong>${SecurityUtils.escapeHtml(item.category || "General")}</strong>
      <div class="sr-feedback-stars">${Feedback.renderStars(item.rating)}</div>
      <p class="sr-text-muted">${SecurityUtils.escapeHtml(item.message || "")}</p>
    </article>
  `).join("");
}

function updateKpis() {
  const cart = readCart();
  const totalProducts = document.getElementById("kpiProducts");
  const totalCart = document.getElementById("kpiCart");

  if (totalProducts) {
    totalProducts.textContent = String(productsCache.length);
  }

  if (totalCart) {
    totalCart.textContent = String(cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0));
  }
}

async function loadCurrentUser() {
  const data = await ApiClient.request("/api/me", "GET");
  currentUser = data.user || null;
  if (currentUser) {
    localStorage.setItem("user", JSON.stringify(currentUser));
  }

  const welcomeCopy = document.getElementById("welcomeCopy");
  const params = new URLSearchParams(window.location.search);
  const adminPreview = params.get("adminPreview") === "1";
  const previewBar = document.getElementById("adminPreviewBar");

  if (currentUser && currentUser.role === "admin" && !adminPreview) {
    window.location.replace("admin/products.html");
    return;
  }

  if (previewBar) {
    if (currentUser && currentUser.role === "admin" && adminPreview) {
      previewBar.classList.remove("sr-hidden");
    } else {
      previewBar.classList.add("sr-hidden");
    }
  }

  if (welcomeCopy && currentUser) {
    welcomeCopy.textContent = `Welcome back, ${currentUser.name || currentUser.username}. Your favorites, orders, and delivery details are ready.`;
  }
}

async function loadProducts() {
  const response = await ApiClient.request("/api/products", "GET");
  productsCache = Array.isArray(response.products) ? response.products : [];
}

async function loadOrders() {
  const response = await ApiClient.request("/api/orders", "GET");
  ordersCache = Array.isArray(response.orders) ? response.orders : [];
}

async function refreshDashboardData(silent = false) {
  try {
    await Promise.all([loadProducts(), loadOrders()]);
    renderCategoryFilters();
    renderProducts();
    renderOrders();
    updateKpis();
  } catch (error) {
    if (!silent) {
      Notify.error(SecurityUtils.getSafeErrorMessage(error));
    }
  }
}

function openProfileModal() {
  const modal = document.getElementById("profileModal");
  if (!modal) {
    return;
  }

  const user = currentUser || SecurityUtils.getSafeUserData() || {};
  document.getElementById("profileName").value = user.name || user.username || "";
  document.getElementById("profileEmail").value = user.email || "";
  document.getElementById("profilePhone").value = user.phone || "";
  document.getElementById("profileLocation").value = user.location || "";
  document.getElementById("profileError").classList.remove("is-visible");
  modal.classList.remove("sr-hidden");
}

function closeProfileModal() {
  document.getElementById("profileModal")?.classList.add("sr-hidden");
}

async function saveProfile(event) {
  event.preventDefault();

  const errorBanner = document.getElementById("profileError");
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const location = document.getElementById("profileLocation").value.trim();

  errorBanner.classList.remove("is-visible");

  if (name.length < 2 || name.length > 60) {
    errorBanner.textContent = "Name must be between 2 and 60 characters.";
    errorBanner.classList.add("is-visible");
    return;
  }

  if (!SecurityUtils.isValidEmail(email)) {
    errorBanner.textContent = "Please use a valid email address.";
    errorBanner.classList.add("is-visible");
    return;
  }

  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    errorBanner.textContent = "Phone number must be 7 to 20 characters.";
    errorBanner.classList.add("is-visible");
    return;
  }

  if (location.length < 3 || location.length > 150) {
    errorBanner.textContent = "Delivery address must be between 3 and 150 characters.";
    errorBanner.classList.add("is-visible");
    return;
  }

  try {
    const response = await ApiClient.request("/api/profile", "PUT", {
      name,
      email,
      phone,
      location,
    });

    currentUser = {
      ...(currentUser || {}),
      ...(response.user || {}),
    };

    localStorage.setItem("user", JSON.stringify(currentUser));
    closeProfileModal();
    Notify.success("Profile saved.");
  } catch (error) {
    errorBanner.textContent = SecurityUtils.getSafeErrorMessage(error);
    errorBanner.classList.add("is-visible");
  }
}

async function cancelOrder(orderId) {
  const confirmed = await Notify.confirm("Cancel this order and restore its stock?", "Cancel Order");
  if (!confirmed) {
    return;
  }

  try {
    await ApiClient.request("/api/orders", "PUT", {
      orderId,
      status: "cancelled",
    });

    await Promise.all([loadProducts(), loadOrders()]);
    renderCategoryFilters();
    renderProducts();
    renderOrders();
    updateKpis();
    Notify.success("Order cancelled.");
  } catch (error) {
    Notify.error(SecurityUtils.getSafeErrorMessage(error));
  }
}

function bindMenuActions() {
  document.getElementById("menuGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const product = productsCache.find((item) => String(item.id) === String(button.dataset.id));
    if (!product) {
      return;
    }

    const availableQty = Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 99;
    const currentQty = getCartQuantity(product.id);

    if (button.dataset.action === "decrease") {
      setCartQuantity(product, currentQty - 1);
      renderProducts();
      updateKpis();
      return;
    }

    if (button.dataset.action === "increase") {
      if (currentQty >= availableQty) {
        Notify.warning(`Only ${availableQty} left for ${product.name}.`);
        return;
      }

      setCartQuantity(product, currentQty + 1);
      renderProducts();
      updateKpis();
      return;
    }

    if (button.dataset.action === "add") {
      if (availableQty <= 0) {
        Notify.warning(`${product.name} is currently sold out.`);
        return;
      }

      const nextQty = currentQty > 0 ? currentQty : 1;
      setCartQuantity(product, nextQty);
      renderProducts();
      updateKpis();
      Notify.success(`${product.name} added to cart.`);
    }
  });

  document.getElementById("customerOrders")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='cancel-order']");
    if (!button) {
      return;
    }

    cancelOrder(button.dataset.id);
  });
}

function bindHeaderActions() {
  document.querySelector(".contact-btn")?.addEventListener("click", () => {
    window.location.href = "contact.html";
  });

  document.querySelector(".checkout-btn")?.addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  document.querySelector(".logout-btn")?.addEventListener("click", async () => {
    ApiClient.clearAuthToken();
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("user");
    localStorage.removeItem(CART_KEY);
    try {
      await ApiClient.request("/api/logout", "POST");
    } catch {
      // Best-effort logout.
    }
    window.location.replace("index.html");
  });

  document.getElementById("profileBtn")?.addEventListener("click", openProfileModal);
  document.getElementById("menuFeedbackBtn")?.addEventListener("click", () => {
    Feedback.showFeedbackForm();
  });
  document.getElementById("notificationBtn")?.addEventListener("click", async () => {
    const granted = await Notify.requestPermission();
    if (granted) {
      Notify.push("Sweet Royals", {
        body: "Order alerts are enabled on this device.",
      });
    }
  });

  document.getElementById("headerNotificationBtn")?.addEventListener("click", async () => {
    const granted = await Notify.requestPermission();
    if (granted) {
      Notify.success("Notifications enabled.");
    }
  });

  document.getElementById("mobileNavToggle")?.addEventListener("click", () => {
    document.getElementById("primaryNav")?.classList.toggle("is-open");
  });

  document.getElementById("backToAdminBtn")?.addEventListener("click", () => {
    window.location.href = "admin/products.html";
  });
}

function bindSearchAndFilters() {
  const searchInput = document.getElementById("menuSearch");
  const handleSearch = SecurityUtils.debounce((event) => {
    activeSearch = normalizeSearchText(event.target.value);
    renderProducts();
  }, 120);

  searchInput?.addEventListener("input", handleSearch);
  searchInput?.addEventListener("search", handleSearch);

  document.getElementById("categoryFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }

    activeCategory = button.dataset.category;
    renderCategoryFilters();
    renderProducts();
  });
}

function bindProfileModal() {
  document.getElementById("closeProfileModal")?.addEventListener("click", closeProfileModal);
  document.getElementById("cancelProfileBtn")?.addEventListener("click", closeProfileModal);
  document.getElementById("profileModal")?.addEventListener("click", (event) => {
    if (event.target.id === "profileModal") {
      closeProfileModal();
    }
  });
  document.getElementById("profileForm")?.addEventListener("submit", saveProfile);
}

window.addEventListener("storage", (event) => {
  if (event.key === CART_KEY) {
    renderProducts();
    updateKpis();
  }

  if (event.key === FEEDBACK_KEY) {
    renderFeedbackPreview();
  }
});

window.addEventListener("feedback:updated", () => {
  renderFeedbackPreview();
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadCurrentUser();
  } catch {
    ApiClient.clearAuthToken();
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("user");
    window.location.href = "index.html";
    return;
  }

  try {
    await refreshDashboardData(false);
  } catch (error) {
    Notify.error(SecurityUtils.getSafeErrorMessage(error));
  }
  renderFeedbackPreview();
  updateKpis();

  bindHeaderActions();
  bindSearchAndFilters();
  bindMenuActions();
  bindProfileModal();

  refreshTimer = window.setInterval(() => {
    refreshDashboardData(true);
  }, 30000);
});

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});
