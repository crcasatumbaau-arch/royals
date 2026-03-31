document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const verificationCodeField = document.getElementById("verificationCodeField");
  const verificationCodeInput = document.getElementById("verificationCode");
  const verificationHint = document.getElementById("verificationHint");
  const showPasswordInput = document.getElementById("showPassword");
  const errorBanner = document.getElementById("loginError");
  const successBanner = document.getElementById("loginSuccess");
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnText = document.getElementById("loginBtnText");
  const loginLoader = document.getElementById("loginLoader");
  const enableNotificationsBtn = document.getElementById("enableNotificationsBtn");
  const forgotPasswordToggle = document.getElementById("forgotPasswordToggle");
  const forgotPasswordPanel = document.getElementById("forgotPasswordPanel");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const forgotEmailInput = document.getElementById("forgotEmail");
  const forgotCodeInput = document.getElementById("forgotCode");
  const forgotNewPasswordInput = document.getElementById("forgotNewPassword");
  const requestResetCodeBtn = document.getElementById("requestResetCodeBtn");

  let twoFactorRequired = false;

  if (!form || !identifierInput || !passwordInput) {
    return;
  }

  const setLoading = (isLoading) => {
    loginBtn.disabled = isLoading;
    loginBtnText.textContent = isLoading
      ? (twoFactorRequired ? "Verifying..." : "Signing In...")
      : (twoFactorRequired ? "Verify and Sign In" : "Sign In");
    loginLoader.classList.toggle("sr-hidden", !isLoading);
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

  const enableTwoFactorStep = (response) => {
    twoFactorRequired = true;
    verificationCodeField?.classList.remove("sr-hidden");
    verificationCodeInput?.focus();
    verificationHint.textContent = response.previewCode
      ? `Verification code sent to ${response.maskedEmail}. Preview code: ${response.previewCode}`
      : `Verification code sent to ${response.maskedEmail}.`;
    setLoading(false);
  };

  showPasswordInput?.addEventListener("change", () => {
    passwordInput.type = showPasswordInput.checked ? "text" : "password";
    if (forgotNewPasswordInput) {
      forgotNewPasswordInput.type = showPasswordInput.checked ? "text" : "password";
    }
  });

  enableNotificationsBtn?.addEventListener("click", async () => {
    const granted = await Notify.requestPermission();
    if (granted) {
      Notify.success("Browser notifications are ready.");
    }
  });

  [identifierInput, passwordInput, verificationCodeInput, forgotEmailInput, forgotCodeInput, forgotNewPasswordInput]
    .forEach((input) => input?.addEventListener("input", clearMessages));

  forgotPasswordToggle?.addEventListener("click", () => {
    forgotPasswordPanel?.classList.toggle("sr-hidden");
  });

  requestResetCodeBtn?.addEventListener("click", async () => {
    clearMessages();
    const email = forgotEmailInput.value.trim();

    if (!SecurityUtils.isValidEmail(email)) {
      showError("Enter a valid email address first.");
      return;
    }

    requestResetCodeBtn.disabled = true;

    try {
      const response = await ApiClient.request("/api/request-password-reset", "POST", { email });
      showSuccess(response.previewCode
        ? `${response.message} Preview code: ${response.previewCode}`
        : response.message);
    } catch (error) {
      showError(SecurityUtils.getSafeErrorMessage(error) || "Failed to send reset code.");
    } finally {
      requestResetCodeBtn.disabled = false;
    }
  });

  forgotPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const email = forgotEmailInput.value.trim();
    const code = forgotCodeInput.value.trim();
    const newPassword = forgotNewPasswordInput.value;

    if (!SecurityUtils.isValidEmail(email)) {
      showError("Enter a valid email address.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      showError("Enter the 6-digit verification code.");
      return;
    }

    const passwordState = SecurityUtils.validatePassword(newPassword);
    if (!passwordState.valid) {
      showError(passwordState.message);
      return;
    }

    try {
      const response = await ApiClient.request("/api/reset-password", "POST", {
        email,
        code,
        newPassword,
      });
      showSuccess(response.message || "Password reset successful.");
      forgotPasswordForm.reset();
      forgotPasswordPanel.classList.add("sr-hidden");
    } catch (error) {
      showError(SecurityUtils.getSafeErrorMessage(error) || "Failed to reset password.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    const verificationCode = verificationCodeInput?.value.trim() || "";

    if (!identifier || !password) {
      showError("Enter your username or email and password.");
      return;
    }

    if (SecurityUtils.containsDangerousText(identifier)) {
      showError("Unsafe characters were detected.");
      return;
    }

    const passwordState = SecurityUtils.validatePassword(password);
    if (!passwordState.valid) {
      showError(passwordState.message);
      return;
    }

    if (twoFactorRequired && !/^\d{6}$/.test(verificationCode)) {
      showError("Enter the 6-digit verification code from your email.");
      return;
    }

    setLoading(true);

    try {
      const response = await ApiClient.request("/api/login", "POST", {
        identifier,
        username: identifier,
        password,
        verificationCode,
      });

      if (response.requiresTwoFactor) {
        showSuccess(response.message || "Verification code sent.");
        enableTwoFactorStep(response);
        return;
      }

      ApiClient.setAuthToken(response.token);
      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("user", JSON.stringify(response.user || {}));

      if (response.user?.role === "admin") {
        localStorage.setItem("adminSession", JSON.stringify({
          username: response.user.username,
          role: "admin",
          loggedInAt: new Date().toISOString(),
        }));
      } else {
        localStorage.removeItem("adminSession");
      }

      Notify.success("Login successful.");
      Notify.push("Sweet Royals", {
        body: "You are now signed in and ready to order.",
      });

      window.location.replace(response.user?.role === "admin" ? "admin/products.html" : "menu.html");
    } catch (error) {
      showError(SecurityUtils.getSafeErrorMessage(error) || "Login failed.");
      setLoading(false);
    }
  });
});
