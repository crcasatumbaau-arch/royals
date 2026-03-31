const ADMIN_STORAGE_KEY = "adminSession";
let adminOrderWatcherStarted = false;
let knownAdminOrderIds = [];
let adminOrderWatcherTimer = null;

function readAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  ApiClient.clearAuthToken();
}

async function ensureAdminSession() {
  const session = readAdminSession();
  const token = ApiClient.getAuthToken();

  if (document.body) {
    document.body.style.visibility = "hidden";
  }

  if (!session || !session.username || !token) {
    clearAdminSession();
    window.location.replace("../index.html");
    return null;
  }

  try {
    const data = await ApiClient.request("/api/me", "GET");
    const user = data.user || {};

    if (user.role !== "admin") {
      throw new Error("Admin access required.");
    }

    if (document.body) {
      document.body.style.visibility = "visible";
    }

    return user;
  } catch (error) {
    clearAdminSession();
    window.location.replace("../index.html");
    return null;
  }
}

function bindAdminLogout() {
  const logoutButton = document.querySelector(".logout");
  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener("click", async function () {
    stopAdminOrderWatcher();
    clearAdminSession();

    try {
      await ApiClient.request("/api/logout", "POST");
    } catch (error) {
      // Best effort logout
    }

    window.location.replace("../index.html");
  });
}

async function checkForNewAdminOrders() {
  try {
    const data = await ApiClient.request("/api/orders", "GET");
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const ids = orders.map(function (order) {
      return String(order.id || "");
    }).filter(Boolean);

    if (knownAdminOrderIds.length > 0) {
      const newOrders = orders.filter(function (order) {
        return !knownAdminOrderIds.includes(String(order.id || ""));
      });

      if (newOrders.length > 0) {
        const latest = newOrders[0];
        Notify.warning("New customer order received.");
        Notify.push("New Sweet Royals Order", {
          body: (latest.customerName || "Customer") + " placed a new order.",
        });
        document.dispatchEvent(new CustomEvent("admin:new-order"));
      }
    }

    knownAdminOrderIds = ids;
  } catch (error) {
    // Keep watcher quiet on temporary request errors.
  }
}

function startAdminOrderWatcher() {
  if (adminOrderWatcherStarted) {
    return;
  }

  adminOrderWatcherStarted = true;
  checkForNewAdminOrders();
  adminOrderWatcherTimer = window.setInterval(checkForNewAdminOrders, 15000);
}

function stopAdminOrderWatcher() {
  adminOrderWatcherStarted = false;
  knownAdminOrderIds = [];

  if (adminOrderWatcherTimer) {
    window.clearInterval(adminOrderWatcherTimer);
    adminOrderWatcherTimer = null;
  }
}

window.addEventListener("pageshow", function () {
  const session = readAdminSession();
  const token = ApiClient.getAuthToken();

  if (!session || !session.username || !token) {
    window.location.replace("../index.html");
  }
});

document.addEventListener("auth:unauthorized", function () {
  stopAdminOrderWatcher();
  clearAdminSession();
  window.location.replace("../index.html");
});

document.addEventListener("auth:logout", function () {
  stopAdminOrderWatcher();
  clearAdminSession();
  window.location.replace("../index.html");
});

window.ensureAdminSession = ensureAdminSession;
window.bindAdminLogout = bindAdminLogout;
window.startAdminOrderWatcher = startAdminOrderWatcher;
