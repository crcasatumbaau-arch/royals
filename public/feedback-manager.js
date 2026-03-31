var Feedback = {
  storageKey: "sr-feedback",
  endpoint: "/api/feedback",
  starGlyph: "★",

  renderStars: function (rating) {
    var count = Math.max(1, Math.min(5, Number(rating) || 0));
    return this.starGlyph.repeat(count);
  },

  showFeedbackForm: function () {
    var overlay = document.createElement("div");
    overlay.className = "sr-modal-overlay";

    overlay.innerHTML = `
      <div class="sr-modal">
        <div class="sr-inline-between" style="margin-bottom:1rem;">
          <div>
            <h2 class="sr-heading-md">Food Satisfaction Feedback</h2>
            <p class="sr-text-muted">Tell us how satisfied you were with the food, flavor, freshness, and overall experience.</p>
          </div>
          <button class="sr-icon-btn" type="button" data-dismiss>x</button>
        </div>

        <form id="feedbackForm" novalidate>
          <div class="sr-field">
            <label for="feedbackCategory">Category</label>
            <select id="feedbackCategory" required>
              <option value="">Choose one</option>
              <option value="taste">Taste</option>
              <option value="freshness">Freshness</option>
              <option value="portion">Portion Size</option>
              <option value="presentation">Presentation</option>
              <option value="service">Overall Satisfaction</option>
            </select>
          </div>

          <div class="sr-field">
            <label>Rating</label>
            <div class="sr-rating-group" id="feedbackRatingGroup">
              <button class="sr-rating-btn" type="button" data-rating="1" aria-label="Rate 1 star">${this.starGlyph}</button>
              <button class="sr-rating-btn" type="button" data-rating="2" aria-label="Rate 2 stars">${this.starGlyph}</button>
              <button class="sr-rating-btn" type="button" data-rating="3" aria-label="Rate 3 stars">${this.starGlyph}</button>
              <button class="sr-rating-btn" type="button" data-rating="4" aria-label="Rate 4 stars">${this.starGlyph}</button>
              <button class="sr-rating-btn" type="button" data-rating="5" aria-label="Rate 5 stars">${this.starGlyph}</button>
            </div>
            <input id="feedbackRating" type="hidden" required>
          </div>

          <div class="sr-field">
            <label for="feedbackMessage">Message</label>
            <textarea id="feedbackMessage" maxlength="1000" required></textarea>
            <div class="sr-helper" id="feedbackCount">0 / 1000</div>
          </div>

          <label class="sr-inline" for="feedbackContact">
            <input id="feedbackContact" type="checkbox">
            <span class="sr-helper">Sweet Royals can contact me about this feedback.</span>
          </label>

          <div class="sr-inline-between" style="margin-top:1.25rem;">
            <button class="sr-btn sr-btn-secondary" type="button" data-dismiss>Cancel</button>
            <button class="sr-btn" type="submit">Submit Feedback</button>
          </div>
        </form>
      </div>
    `;

    var self = this;
    var form = overlay.querySelector("#feedbackForm");
    var ratingInput = overlay.querySelector("#feedbackRating");
    var messageInput = overlay.querySelector("#feedbackMessage");
    var countLabel = overlay.querySelector("#feedbackCount");
    var ratingButtons = overlay.querySelectorAll("[data-rating]");
    var closeButtons = overlay.querySelectorAll("[data-dismiss]");

    function closeBox() {
      overlay.remove();
    }

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        closeBox();
      }
    });

    closeButtons.forEach(function (button) {
      button.addEventListener("click", closeBox);
    });

    ratingButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        ratingInput.value = button.dataset.rating;

        ratingButtons.forEach(function (oneButton) {
          oneButton.classList.remove("is-selected");
        });

        button.classList.add("is-selected");
      });
    });

    messageInput.addEventListener("input", function () {
      countLabel.textContent = messageInput.value.length + " / 1000";
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var category = overlay.querySelector("#feedbackCategory").value.trim();
      var rating = Number(ratingInput.value);
      var message = messageInput.value.trim();
      var allowContact = overlay.querySelector("#feedbackContact").checked;

      if (!category || !rating || !message) {
        Notify.warning("Please complete the feedback form first.");
        return;
      }

      var user = SecurityUtils.getSafeUserData() || {};
      var payload = {
        category: category,
        rating: rating,
        message: message,
        allowContact: allowContact,
        contactEmail: user.email || "",
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
      };

      var loadingId = Notify.loading("Sending feedback...");

      try {
        await ApiClient.request(self.endpoint, "POST", payload);
        Notify.dismiss(loadingId);
        Notify.success("Feedback sent. Thank you.");
        self.storeFeedbackLocally({
          category: payload.category,
          rating: payload.rating,
          message: payload.message,
          allowContact: payload.allowContact,
          contactEmail: payload.contactEmail,
          page: payload.page,
          timestamp: payload.timestamp,
          submitted: true,
        });
        closeBox();
        window.dispatchEvent(new Event("feedback:updated"));
      } catch (error) {
        Notify.dismiss(loadingId);
        Notify.error(SecurityUtils.getSafeErrorMessage(error));
        self.storeFeedbackLocally({
          category: payload.category,
          rating: payload.rating,
          message: payload.message,
          allowContact: payload.allowContact,
          contactEmail: payload.contactEmail,
          page: payload.page,
          timestamp: payload.timestamp,
          submitted: false,
        });
        closeBox();
        window.dispatchEvent(new Event("feedback:updated"));
      }
    });

    document.body.appendChild(overlay);
  },

  storeFeedbackLocally: function (feedback) {
    var current = this.getStoredFeedback();

    current.push({
      category: feedback.category,
      rating: feedback.rating,
      message: feedback.message,
      allowContact: feedback.allowContact,
      contactEmail: feedback.contactEmail,
      page: feedback.page,
      timestamp: feedback.timestamp || new Date().toISOString(),
      submitted: feedback.submitted,
    });

    localStorage.setItem(this.storageKey, JSON.stringify(current.slice(-20)));
  },

  getStoredFeedback: function () {
    try {
      var raw = localStorage.getItem(this.storageKey) || "[]";
      var parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return [];
    } catch (error) {
      return [];
    }
  },

  clearStoredFeedback: function () {
    localStorage.removeItem(this.storageKey);
  }
};

window.Feedback = Feedback;
