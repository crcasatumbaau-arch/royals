class NotificationManager {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.permissionAskedKey = "sr-notification-permission";
    this.init();
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      if (!document.getElementById("toast-container")) {
        const container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
        this.container = container;
      } else {
        this.container = document.getElementById("toast-container");
      }
    });
  }

  ensureContainer() {
    if (!this.container) {
      this.container = document.getElementById("toast-container");
    }

    if (!this.container) {
      const container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
      this.container = container;
    }
  }

  show(message, type = "info", duration = 3200) {
    this.ensureContainer();
    const id = Date.now() + Math.random();
    const toast = document.createElement("div");
    toast.id = `toast-${id}`;
    toast.className = `toast ${type}`;

    const iconByType = {
      success: "OK",
      error: "!",
      warning: "!",
      info: "i",
      loading: "...",
    };

    toast.innerHTML = `
      <div style="display:flex; gap:0.8rem; align-items:flex-start;">
        <strong>${this.escapeHtml(iconByType[type] || "i")}</strong>
        <div>${this.escapeHtml(message)}</div>
      </div>
    `;

    this.container.appendChild(toast);
    this.notifications.push(id);

    if (duration > 0) {
      window.setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id) {
    const toast = document.getElementById(`toast-${id}`);
    if (!toast) {
      return;
    }

    toast.classList.add("removing");
    window.setTimeout(() => {
      toast.remove();
      this.notifications = this.notifications.filter((entry) => entry !== id);
    }, 220);
  }

  dismissAll() {
    [...this.notifications].forEach((id) => this.dismiss(id));
  }

  success(message, duration) {
    return this.show(message, "success", duration ?? 3000);
  }

  error(message, duration) {
    return this.show(message, "error", duration ?? 4200);
  }

  warning(message, duration) {
    return this.show(message, "warning", duration ?? 3600);
  }

  info(message, duration) {
    return this.show(message, "info", duration ?? 2800);
  }

  loading(message) {
    return this.show(message, "loading", 0);
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      this.warning("Browser notifications are not supported here.");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      this.warning("Browser notifications were blocked for this site.");
      return false;
    }

    localStorage.setItem(this.permissionAskedKey, "true");
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      this.success("Browser notifications enabled.");
      return true;
    }

    this.warning("Notification permission was not granted.");
    return false;
  }

  push(title, options = {}) {
    if ("Notification" in window && Notification.permission === "granted") {
      return new Notification(this.escapeHtml(title), {
        body: this.escapeHtml(options.body || ""),
      });
    }

    if (options.body) {
      this.info(`${title}: ${options.body}`);
    } else {
      this.info(title);
    }

    return null;
  }

  confirm(message, title = "Confirm") {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "sr-modal-overlay";
      overlay.innerHTML = `
        <div class="sr-modal">
          <div class="sr-inline-between" style="margin-bottom:1rem;">
            <h2 class="sr-heading-md">${this.escapeHtml(title)}</h2>
            <button class="sr-icon-btn" type="button" data-close>x</button>
          </div>
          <p class="sr-text-muted">${this.escapeHtml(message)}</p>
          <div class="sr-inline-between" style="margin-top:1.25rem;">
            <button class="sr-btn sr-btn-secondary" type="button" data-cancel>Cancel</button>
            <button class="sr-btn" type="button" data-confirm>Confirm</button>
          </div>
        </div>
      `;

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          cleanup(false);
        }
      });

      overlay.querySelector("[data-close]")?.addEventListener("click", () => cleanup(false));
      overlay.querySelector("[data-cancel]")?.addEventListener("click", () => cleanup(false));
      overlay.querySelector("[data-confirm]")?.addEventListener("click", () => cleanup(true));

      document.body.appendChild(overlay);
    });
  }

  alert(message, title = "Notice") {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "sr-modal-overlay";
      overlay.innerHTML = `
        <div class="sr-modal">
          <div class="sr-inline-between" style="margin-bottom:1rem;">
            <h2 class="sr-heading-md">${this.escapeHtml(title)}</h2>
            <button class="sr-icon-btn" type="button" data-close>x</button>
          </div>
          <p class="sr-text-muted">${this.escapeHtml(message)}</p>
          <div style="margin-top:1.25rem;">
            <button class="sr-btn" type="button" data-ok>OK</button>
          </div>
        </div>
      `;

      const cleanup = () => {
        overlay.remove();
        resolve();
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          cleanup();
        }
      });

      overlay.querySelector("[data-close]")?.addEventListener("click", cleanup);
      overlay.querySelector("[data-ok]")?.addEventListener("click", cleanup);

      document.body.appendChild(overlay);
    });
  }

  escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }
}

window.Notify = new NotificationManager();
