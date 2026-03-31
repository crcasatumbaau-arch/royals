function renderFeedbackShowcase() {
  const container = document.getElementById("feedbackShowcase");
  if (!container) {
    return;
  }

  const feedbackItems = Feedback.getStoredFeedback()
    .filter((item) => item && item.message)
    .slice(-6)
    .reverse();

  if (!feedbackItems.length) {
    container.innerHTML = `
      <div class="sr-empty-state">
        <p>No feedback shared yet. Be the first to tell us how the app feels.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = feedbackItems.map((item) => `
    <article class="sr-feedback-card">
      <div class="sr-inline-between">
        <strong>${SecurityUtils.escapeHtml(item.category || "General")}</strong>
        <span class="sr-feedback-stars">${Feedback.renderStars(item.rating)}</span>
      </div>
      <p class="sr-text-muted">${SecurityUtils.escapeHtml(item.message || "")}</p>
      <small class="sr-text-muted">${item.submitted ? "Submitted" : "Saved locally"} • ${new Date(item.timestamp || Date.now()).toLocaleDateString("en-PH")}</small>
    </article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    window.location.href = "menu.html";
  });

  document.getElementById("checkoutBtn")?.addEventListener("click", () => {
    window.location.href = "checkout.html";
  });

  document.getElementById("loginBtn")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  document.getElementById("openFeedbackBtn")?.addEventListener("click", () => {
    Feedback.showFeedbackForm();
  });

  renderFeedbackShowcase();
});

window.addEventListener("storage", (event) => {
  if (event.key === "sr-feedback") {
    renderFeedbackShowcase();
  }
});

window.addEventListener("feedback:updated", () => {
  renderFeedbackShowcase();
});
