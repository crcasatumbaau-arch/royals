/**
 * Enhanced API Client with Security Features
 * - CSRF Protection
 * - Request validation
 * - Automatic retry on failure
 * - Rate limiting
 */
(function () {
  const TOKEN_KEY = "authToken";
  const CSRF_TOKEN_KEY = "csrfToken";
  const REQUEST_TIMEOUT = 15000; // 15 seconds
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // Start with 1 second
  
  let requestQueue = [];
  let rateLimitMap = new Map();

  /**
   * Set authentication token securely
   */
  function setAuthToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      // Also set secure token metadata
      localStorage.setItem(TOKEN_KEY + '_timestamp', Date.now());
      localStorage.setItem(TOKEN_KEY + '_secure', 'true');
    } else {
      clearAuthToken();
    }
  }

  /**
   * Get authentication token
   */
  function getAuthToken() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return "";
    
    // Check token expiry (24 hours)
    const timestamp = parseInt(localStorage.getItem(TOKEN_KEY + '_timestamp') || 0);
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      clearAuthToken();
      return "";
    }
    
    return token;
  }

  /**
   * Clear auth token completely
   */
  function clearAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY + '_timestamp');
    localStorage.removeItem(TOKEN_KEY + '_secure');
  }

  /**
   * Get CSRF token from meta tag or generate
   */
  function getCsrfToken() {
    let token = localStorage.getItem(CSRF_TOKEN_KEY);
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    
    if (metaTag) {
      token = metaTag.getAttribute('content');
      localStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    
    if (!token) {
      token = generateRandomToken();
      localStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    
    return token;
  }

  /**
   * Generate random token for CSRF protection
   */
  function generateRandomToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate request parameters
   */
  function validateRequest(method, body) {
    if (method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      throw new Error('Invalid HTTP method');
    }
    
    if (body && typeof body !== 'object') {
      throw new Error('Request body must be an object');
    }
    
    return true;
  }

  /**
   * Check rate limiting
   */
  function checkRateLimit(path) {
    const now = Date.now();
    const key = path;
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, {
        count: 0,
        resetTime: now + 60000 // 1 minute window
      });
    }
    
    const limit = rateLimitMap.get(key);
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 60000;
    }
    
    limit.count++;
    
    // Max 30 requests per minute per endpoint
    if (limit.count > 30) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
  }

  /**
   * Make API request with retry logic
   */
  async function apiRequest(path, method = 'GET', body = null, retryCount = 0) {
    try {
      validateRequest(method, body);
      checkRateLimit(path);
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrfToken(),
      };

      const token = getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Add request timestamp for security
      headers['X-Request-Time'] = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(path, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          credentials: 'same-origin', // Include credentials for CSRF
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let data = {};
        let text = '';

        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (e) {
            data = {};
          }
        } else {
          try {
            text = await response.text();
          } catch (e) {
            text = '';
          }
        }

        // Handle unauthorized
        if (response.status === 401) {
          clearAuthToken();
          // Dispatch custom event for logout
          document.dispatchEvent(new CustomEvent('auth:unauthorized'));
          throw new Error('Authentication failed. Please log in again.');
        }

        if (!response.ok) {
          const fallback = `Request failed (${response.status}).`;
          const error = data.error || text.trim() || fallback;
          
          // Retry on 5xx errors
          if (response.status >= 500 && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return apiRequest(path, method, body, retryCount + 1);
          }
          
          throw new Error(error);
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. Please check your connection.');
        }
        
        throw error;
      }
    } catch (error) {
      // Log security events
      if (error.message.includes('CSRF') || error.message.includes('Unauthorized')) {
        console.warn('Security event detected:', error.message);
      }
      throw error;
    }
  }

  /**
   * Get current session info
   */
  function getSessionInfo() {
    return {
      authenticated: !!getAuthToken(),
      tokenAge: Date.now() - parseInt(localStorage.getItem(TOKEN_KEY + '_timestamp') || 0),
      hasSession: localStorage.getItem(TOKEN_KEY + '_secure') === 'true'
    };
  }

  // Expose API
  window.ApiClient = {
    setAuthToken,
    getAuthToken,
    clearAuthToken,
    getCsrfToken,
    request: apiRequest,
    getSessionInfo,
  };

  // Handle tab synchronization - logout if token cleared in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY && !e.newValue) {
      clearAuthToken();
      document.dispatchEvent(new CustomEvent('auth:logout'));
    }
  });
})();
