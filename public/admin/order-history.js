const ordersList = document.querySelector("#orders-list");
let ordersCache = [];

function formatDate(value) {
  if (!value) {
    return "Pending date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPrice(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function loadOrders() {
  const data = await ApiClient.request("/api/orders", "GET");
  ordersCache = Array.isArray(data.orders) ? data.orders : [];
}

function updateOrderStats() {
  const totalBox = document.getElementById("adminOrderCount");
  const pendingBox = document.getElementById("adminPendingCount");
  const pendingCount = ordersCache.filter((order) => (order.status || "").toLowerCase() === "pending").length;

  if (totalBox) {
    totalBox.textContent = String(ordersCache.length);
  }

  if (pendingBox) {
    pendingBox.textContent = String(pendingCount);
  }
}

function getStatusBadge(order) {
  const status = String(order.status || "pending").toLowerCase();

  if (status === "confirmed") {
    return `<span class="status-badge completed">Confirmed</span>`;
  }

  if (status === "cancelled") {
    return `<span class="status-badge cancelled">Cancelled</span>`;
  }

  return `<span class="status-badge pending">Pending</span>`;
}

function getActionButtons(order) {
  const status = String(order.status || "pending").toLowerCase();

  if (status !== "pending") {
    return getStatusBadge(order);
  }

  return `
    <div class="order-actions">
      <button class="decision-button confirm" type="button" data-action="confirm" data-id="${SecurityUtils.escapeAttribute(order.id)}">Confirm</button>
      <button class="decision-button cancel" type="button" data-action="cancel" data-id="${SecurityUtils.escapeAttribute(order.id)}">Cancel</button>
    </div>
  `;
}

function renderOrders() {
  updateOrderStats();

  if (!ordersList) {
    return;
  }

  if (!ordersCache.length) {
    ordersList.innerHTML = `
      <div class="empty-orders">
        Customer orders will appear here when customers checkout from the website or app.
      </div>
    `;
    return;
  }

  ordersList.innerHTML = ordersCache.map(function (order) {
    const contact = order.phone || order.email || "No contact provided";
    const itemsText = Array.isArray(order.items) && order.items.length
      ? order.items.map(function (item) {
          return SecurityUtils.escapeHtml((item.name || "Item") + " x" + (item.qty || 0));
        }).join(", ")
      : "No items listed";

    return `
      <article class="orders-row">
        <div class="order-top">
          <div class="order-details">
            <h3 class="order-name">${SecurityUtils.escapeHtml(order.customerName || "Customer")}</h3>
            <span class="order-meta">Order ID: ${SecurityUtils.escapeHtml(order.id)}</span>
            <span class="order-meta">${SecurityUtils.escapeHtml(contact)}</span>
            ${order.location ? `<span class="order-meta">${SecurityUtils.escapeHtml(order.location)}</span>` : ""}
          </div>
          ${getStatusBadge(order)}
        </div>
        <div class="order-summary" style="margin-top: 0.9rem;">
          <span class="order-meta">${formatDate(order.createdAt)}</span>
          <span class="order-meta">${formatPrice(order.total)}</span>
          <span class="order-meta">${Number(order.itemCount) || 0} item${Number(order.itemCount) === 1 ? "" : "s"}</span>
        </div>
        <p class="order-items" style="margin-top: 0.9rem;">${itemsText}</p>
        <div style="margin-top: 0.9rem;">
          ${getActionButtons(order)}
        </div>
      </article>
    `;
  }).join("");
}

async function updateOrderStatus(orderId, nextStatus) {
  if (nextStatus === "cancelled") {
    const confirmed = await Notify.confirm(
      "Cancel this order and restore its product stock?",
      "Cancel Order"
    );

    if (!confirmed) {
      return;
    }
  }

  try {
    await ApiClient.request("/api/orders", "PUT", {
      orderId: orderId,
      status: nextStatus,
    });

    await loadOrders();
    renderOrders();
    Notify.success("Order updated.");
  } catch (error) {
    Notify.error(SecurityUtils.getSafeErrorMessage(error));
  }
}

if (ordersList) {
  ordersList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const orderId = button.dataset.id;

    if (action === "confirm") {
      updateOrderStatus(orderId, "confirmed");
    }

    if (action === "cancel") {
      updateOrderStatus(orderId, "cancelled");
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  const adminUser = await ensureAdminSession();
  if (!adminUser) {
    return;
  }

  bindAdminLogout();
  startAdminOrderWatcher();

  document.addEventListener("admin:new-order", async function () {
    try {
      await loadOrders();
      renderOrders();
    } catch (error) {
      // Keep the page usable even if the refresh fails.
    }
  });

  try {
    await loadOrders();
    renderOrders();
  } catch (error) {
    if (ordersList) {
      ordersList.innerHTML = `
        <div class="empty-orders">
          ${SecurityUtils.escapeHtml(error.message || "Failed to load orders.")}
        </div>
      `;
    }
  }
});
