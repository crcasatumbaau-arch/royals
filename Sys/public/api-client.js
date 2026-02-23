(function () {
  const TOKEN_KEY = "authToken";

  function setAuthToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function apiRequest(path, method, body) {
    const headers = {
      "Content-Type": "application/json",
    };

    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  window.ApiClient = {
    setAuthToken,
    getAuthToken,
    clearAuthToken: function () {
      setAuthToken("");
    },
    request: apiRequest,
  };
})();
