document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const errorBanner = document.getElementById("registerError");
  const successBanner = document.getElementById("registerSuccess");
  const passwordInput = document.getElementById("regPassword");
  const emailInput = document.getElementById("regEmail");
  const emailCodeInput = document.getElementById("regEmailCode");
  const showPasswordInput = document.getElementById("showRegisterPassword");
  const returnBtn = document.getElementById("returnBtn");
  const registerBtn = document.getElementById("registerBtn");
  const registerBtnText = document.getElementById("registerBtnText");
  const registerLoader = document.getElementById("registerLoader");
  const sendEmailCodeBtn = document.getElementById("sendEmailCodeBtn");

  if (!form) {
    return;
  }

  const setLoading = (isLoading) => {
    registerBtn.disabled = isLoading;
    registerBtnText.textContent = isLoading ? "Creating..." : "Create Account";
    registerLoader.classList.toggle("sr-hidden", !isLoading);
  };

  const clearMessages = () => {
    errorBanner.textContent = "";
    successBanner.textContent = "";
    errorBanner.classList.remove("is-visible");
    successBanner.classList.remove("is-visible");
  };

  const showError = (message) => {
    errorBanner.textContent = message;
    errorBanner.classList.add("is-visible");
  };

  const showSuccess = (message) => {
    successBanner.textContent = message;
    successBanner.classList.add("is-visible");
  };

  showPasswordInput?.addEventListener("change", () => {
    passwordInput.type = showPasswordInput.checked ? "text" : "password";
  });

  returnBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  form.addEventListener("input", clearMessages);

  sendEmailCodeBtn?.addEventListener("click", async () => {
    clearMessages();

    const email = emailInput.value.trim();

    if (email.toLowerCase() === "sweetroyals@gmail.com") {
      showError("That account is reserved for admin only.");
      return;
    }

    if (!SecurityUtils.isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    sendEmailCodeBtn.disabled = true;

    try {
      const response = await ApiClient.request("/api/register", "POST", {
        action: "request-email-verification",
        email,
      });

      showSuccess(
        response.previewCode
          ? `${response.message} Preview code: ${response.previewCode}`
          : (response.message || "Verification code sent.")
      );
      emailCodeInput?.focus();
    } catch (error) {
      showError(SecurityUtils.getSafeErrorMessage(error) || "Failed to send verification code.");
    } finally {
      sendEmailCodeBtn.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const name = document.getElementById("regName").value.trim();
    const email = emailInput.value.trim();
    const verificationCode = emailCodeInput.value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const password = passwordInput.value;
    const address = document.getElementById("regAddress").value.trim();

    if (!SecurityUtils.isValidRealName(name)) {
      showError("Enter your real name using letters and basic punctuation only.");
      return;
    }

    if (email.toLowerCase() === "sweetroyals@gmail.com") {
      showError("That account is reserved for admin only.");
      return;
    }

    if (!SecurityUtils.isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    if (SecurityUtils.containsDangerousText(name) || SecurityUtils.containsDangerousText(email) || SecurityUtils.containsDangerousText(address)) {
      showError("Unsafe characters were detected in the form.");
      return;
    }

    if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
      showError("Phone number must be 7 to 20 characters and contain only phone symbols.");
      return;
    }

    const passwordState = SecurityUtils.validatePassword(password);
    if (!passwordState.valid) {
      showError(passwordState.message);
      return;
    }

    if (address.length < 5 || address.length > 200) {
      showError("Address must be between 5 and 200 characters.");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      showError("Enter the 6-digit email verification code.");
      return;
    }

    setLoading(true);

    try {
      await ApiClient.request("/api/register", "POST", {
        action: "complete-registration",
        name,
        email,
        verificationCode,
        phone,
        password,
        address,
      });

      showSuccess("Registration successful. Redirecting to login...");
      Notify.success("Account created.");

      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } catch (error) {
      showError(SecurityUtils.getSafeErrorMessage(error) || "Registration failed.");
      setLoading(false);
    }
  });
});
