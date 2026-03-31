const STORAGE_KEY = "adminProducts";

const productForm = document.querySelector("#product-form");
const heroUpload = document.querySelector("#hero-upload");
const heroPreview = document.querySelector("#hero-preview");
const heroPlaceholder = document.querySelector("#hero-placeholder");
const heroUploadWrap = document.querySelector(".hero-upload");
const productsList = document.querySelector("#products-list");
const clearFormButton = document.querySelector("#clear-form");
const categoryInput = document.querySelector("#food-category");
const registeredUsersCount = document.querySelector("#registeredUsersCount");
const registeredUsersList = document.querySelector("#registeredUsersList");
const mostBoughtProductCard = document.querySelector("#mostBoughtProductCard");
const leastBoughtProductCard = document.querySelector("#leastBoughtProductCard");
const specialRequestsList = document.querySelector("#specialRequestsList");

let previewImageData = "";
let editingId = null;
let productsCache = [];

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readLegacyProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatPrice(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function resetPreview() {
  previewImageData = "";
  heroPreview.removeAttribute("src");
  heroUploadWrap.classList.remove("has-image");
  heroUpload.value = "";
  heroPlaceholder.hidden = false;
}

function setPreview(imageData) {
  previewImageData = imageData;
  heroPreview.src = imageData;
  heroUploadWrap.classList.add("has-image");
  heroPlaceholder.hidden = true;
}

function resetForm() {
  productForm.reset();
  editingId = null;
  resetPreview();
  if (quantityInput) {
    quantityInput.value = "1";
  }
  const submitButton = productForm.querySelector(".submit-button");
  submitButton.textContent = "Add Food";
}

function isSafeProductText(value, min, max) {
  return SecurityUtils.isSafePlainText(value, min, max);
}

async function fetchProducts() {
  const data = await ApiClient.request("/api/products", "GET");
  productsCache = Array.isArray(data.products) ? data.products : [];
  return productsCache;
}

async function fetchAdminDashboard() {
  return ApiClient.request("/api/admin-dashboard", "GET");
}

function renderProductStat(target, label, product) {
  if (!target) {
    return;
  }

  if (!product) {
    target.innerHTML = `
      <strong>${label}</strong>
      <p class="sr-text-muted">No product data yet.</p>
    `;
    return;
  }

  target.innerHTML = `
    <strong>${label}</strong>
    <h4>${SecurityUtils.escapeHtml(product.name || "Unnamed Product")}</h4>
    <p class="sr-text-muted">${Number(product.totalBought) || 0} item(s) bought</p>
  `;
}

function renderRegisteredUsers(users) {
  if (registeredUsersCount) {
    registeredUsersCount.textContent = `${users.length} account${users.length === 1 ? "" : "s"}`;
  }

  if (!registeredUsersList) {
    return;
  }

  if (!users.length) {
    registeredUsersList.innerHTML = `<div class="empty-products">No registered users yet.</div>`;
    return;
  }

  registeredUsersList.innerHTML = users.map((user) => `
    <article class="admin-user-card">
      <div class="sr-inline-between">
        <strong>${SecurityUtils.escapeHtml(user.name || user.username || "User")}</strong>
        <span class="product-chip">${SecurityUtils.escapeHtml(user.role || "user")}</span>
      </div>
      <p class="sr-text-muted">${SecurityUtils.escapeHtml(user.email || "No email")}</p>
      <p class="sr-text-muted">Joined ${SecurityUtils.escapeHtml(formatDateTime(user.createdAt))}</p>
    </article>
  `).join("");
}

function renderSpecialRequests(requests) {
  if (!specialRequestsList) {
    return;
  }

  if (!requests.length) {
    specialRequestsList.innerHTML = `<div class="empty-products">No special requests yet.</div>`;
    return;
  }

  specialRequestsList.innerHTML = requests.map((request) => `
    <article class="admin-request-card">
      <div class="sr-inline-between">
        <strong>${SecurityUtils.escapeHtml(request.customerName || "Customer")}</strong>
        <span class="sr-text-muted">${SecurityUtils.escapeHtml(formatDateTime(request.createdAt))}</span>
      </div>
      ${request.email ? `<p class="sr-text-muted">${SecurityUtils.escapeHtml(request.email)}</p>` : ""}
      <p>${SecurityUtils.escapeHtml(request.specialRequest || "")}</p>
    </article>
  `).join("");
}

async function loadAdminDashboard() {
  const data = await fetchAdminDashboard();
  const users = Array.isArray(data.registeredUsers) ? data.registeredUsers : [];
  const requests = Array.isArray(data.specialRequests) ? data.specialRequests : [];

  renderRegisteredUsers(users);
  renderProductStat(mostBoughtProductCard, "Most Bought", data.mostBoughtProduct || null);
  renderProductStat(leastBoughtProductCard, "Least Bought", data.leastBoughtProduct || null);
  renderSpecialRequests(requests);
}

async function migrateLegacyProductsIfNeeded() {
  const legacyProducts = readLegacyProducts();
  if (!legacyProducts.length) {
    return;
  }

  const remoteProducts = await fetchProducts();
  if (remoteProducts.length) {
    return;
  }

  for (const product of legacyProducts) {
    await ApiClient.request("/api/products", "POST", product);
  }

  productsCache = legacyProducts;
}

function renderProducts() {
  var productCountBox = document.getElementById("adminProductCount");
  var lowStockBox = document.getElementById("adminLowStockCount");

  if (productCountBox) {
    productCountBox.textContent = String(productsCache.length);
  }

  if (lowStockBox) {
    lowStockBox.textContent = String(productsCache.filter((product) => Number(product.quantity || 0) <= 5).length);
  }

  if (!productsList) {
    return;
  }

  if (!productsCache.length) {
    productsList.innerHTML = `
      <div class="empty-products">
        No foods added yet. Upload one from the form above and it will appear here.
      </div>
    `;
    return;
  }

  productsList.innerHTML = productsCache.map((product) => `
    <article class="product-card" data-id="${product.id}">
      <img class="product-card-media" src="${SecurityUtils.escapeAttribute(product.image)}" alt="${SecurityUtils.escapeAttribute(product.name)}">
      <div class="product-card-body">
        <div class="product-card-top">
          <h3 class="product-name">${SecurityUtils.escapeHtml(product.name)}</h3>
          <span class="product-price">${formatPrice(product.price)}</span>
        </div>
        <div class="product-meta">
          <span class="product-chip">${SecurityUtils.escapeHtml(product.category)}</span>
          <span class="product-quantity">Qty: ${Number(product.quantity ?? 1)}</span>
        </div>
        <p class="product-description">${SecurityUtils.escapeHtml(product.description || "No description added yet.")}</p>
        <div class="product-actions">
          <button class="mini-button update" type="button" data-action="update" data-id="${product.id}">Update</button>
          <button class="mini-button remove" type="button" data-action="remove" data-id="${product.id}">Remove</button>
        </div>
      </div>
    </article>
  `).join("");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function fillForm(product) {
  productForm.name.value = product.name;
  productForm.price.value = product.price;
  productForm.category.value = product.category;
  productForm.quantity.value = product.quantity ?? 1;
  productForm.description.value = product.description || "";
  setPreview(product.image);
  editingId = product.id;
  const submitButton = productForm.querySelector(".submit-button");
  submitButton.textContent = "Save Update";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (heroUpload) {
  heroUpload.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    try {
      const imageData = await readImageFile(file);
      setPreview(imageData);
    } catch {
      resetPreview();
    }
  });
}

if (clearFormButton) {
  clearFormButton.addEventListener("click", resetForm);
}

if (categoryInput) {
  categoryInput.addEventListener("input", () => {
    categoryInput.value = categoryInput.value.replace(/[^A-Za-z ]/g, "");
  });
}

// === SECURITY: Block 'e', 'E' and non-numeric characters in number inputs ===
const priceInput = document.querySelector("#food-price");
const quantityInput = document.querySelector("#food-quantity");
if (priceInput) {
  SecurityUtils.blockNonNumericInput(priceInput, true);
}
if (quantityInput) {
  SecurityUtils.blockNonNumericInput(quantityInput, false);
}

if (productForm) {
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!previewImageData) {
      heroUpload.click();
      return;
    }

    const formData = new FormData(productForm);
    const name = String(formData.get("name") || "").trim();
    const rawPrice = String(formData.get("price") || "").trim();
    const category = String(formData.get("category") || "").trim().replace(/[^A-Za-z ]/g, "");
    const rawQuantity = String(formData.get("quantity") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!category) {
      categoryInput?.focus();
      return;
    }

    if (!isSafeProductText(name, 1, 120)) {
      alert("Food name is invalid or contains unsafe characters.");
      return;
    }

    if (!/^[a-zA-Z0-9 .,'()&-]+$/.test(name)) {
      alert("Food name contains invalid characters.");
      return;
    }

    if (!SecurityUtils.isSafeDecimalString(rawPrice, 2)) {
      alert("Price must be numbers only. Letters and e are not allowed.");
      return;
    }

    if (!SecurityUtils.isSafeIntegerString(rawQuantity)) {
      alert("Quantity must be whole numbers only. Letters and e are not allowed.");
      return;
    }

    if (description && (!isSafeProductText(description, 0, 500) || !/^[a-zA-Z0-9 .,'()!?\-]*$/.test(description))) {
      alert("Description is invalid or contains unsafe characters.");
      return;
    }

    const nextProduct = {
      id: editingId || `PROD-${Date.now()}`,
      name: name,
      price: Number(rawPrice),
      category,
      quantity: Math.max(0, Number(rawQuantity)),
      description: description,
      image: previewImageData,
    };

    try {
      await ApiClient.request("/api/products", editingId ? "PUT" : "POST", nextProduct);
      await fetchProducts();
      renderProducts();
      resetForm();
    } catch (err) {
      alert(err.message || "Failed to save product.");
    }
  });
}

window.addEventListener("storage", async (event) => {
  if (event.key === "productsRefreshSignal") {
    await fetchProducts();
    renderProducts();
  }
});

if (productsList) {
  productsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    const product = productsCache.find((entry) => entry.id === id);

    if (action === "remove") {
      const confirmed = await Notify.confirm(
        "Remove this product from the customer menu?",
        "Remove Product"
      );

      if (!confirmed) {
        return;
      }

      try {
        await ApiClient.request("/api/products", "DELETE", { id });
        await fetchProducts();
        if (editingId === id) {
          resetForm();
        }
        renderProducts();
      } catch (err) {
        alert(err.message || "Failed to remove product.");
      }
      return;
    }

    if (action === "update" && product) {
      fillForm(product);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const adminUser = await ensureAdminSession();
  if (!adminUser) {
    return;
  }

  bindAdminLogout();
  startAdminOrderWatcher();

  try {
    await migrateLegacyProductsIfNeeded();
    await Promise.all([fetchProducts(), loadAdminDashboard()]);
    renderProducts();
    
    // Auto-cleanup expired products every 5 minutes
    setInterval(async () => {
      try {
        await ApiClient.request("/api/products", "PATCH");
        // Refresh products after cleanup
        await fetchProducts();
        renderProducts();
      } catch (err) {
        console.log("Cleanup check completed");
      }
    }, 5 * 60 * 1000);

    setInterval(async () => {
      try {
        await loadAdminDashboard();
      } catch (err) {
        console.log("Admin dashboard refresh skipped");
      }
    }, 30000);
  } catch (err) {
    productsList.innerHTML = `
      <div class="empty-products">
        ${err.message || "Failed to load products."}
      </div>
    `;
  }
});
