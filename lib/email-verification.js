const dns = require("node:dns").promises;

function getDomain(email) {
  return String(email || "").trim().split("@")[1]?.toLowerCase() || "";
}

async function verifyWithAbstractApi(email) {
  const apiKey = String(process.env.EMAIL_VALIDATION_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  const url = new URL("https://emailvalidation.abstractapi.com/v1/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("email", email);
  url.searchParams.set("auto_correct", "false");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Email validation service returned ${response.status}.`);
  }

  const data = await response.json();
  const deliverability = String(data.deliverability || "").toUpperCase();
  const formatValid = data.is_valid_format?.value !== false;
  const mxFound = data.is_mx_found?.value !== false;

  if (deliverability === "DELIVERABLE" && formatValid && mxFound) {
    return {
      valid: true,
      source: "abstractapi",
    };
  }

  return {
    valid: false,
    source: "abstractapi",
    reason: "Enter a real email address that can receive mail.",
  };
}

async function verifyWithDns(email) {
  const domain = getDomain(email);
  if (!domain) {
    return {
      valid: false,
      source: "dns",
      reason: "Email domain is missing.",
    };
  }

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      return {
        valid: true,
        source: "dns",
      };
    }
  } catch (_) {
    // Fall through to A/AAAA lookup below.
  }

  try {
    const [aRecords, aaaaRecords] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolve6(domain),
    ]);

    const hasAddress =
      (aRecords.status === "fulfilled" && aRecords.value.length > 0) ||
      (aaaaRecords.status === "fulfilled" && aaaaRecords.value.length > 0);

    if (hasAddress) {
      return {
        valid: true,
        source: "dns",
      };
    }
  } catch (_) {
    // Ignore and return invalid below.
  }

  return {
    valid: false,
    source: "dns",
    reason: "We could not verify that email domain.",
  };
}

async function verifyEmailAddress(email) {
  try {
    const apiResult = await verifyWithAbstractApi(email);
    if (apiResult) {
      return apiResult;
    }
  } catch (_) {
    // Fall back to DNS checks if the external service is unavailable.
  }

  return verifyWithDns(email);
}

module.exports = {
  verifyEmailAddress,
};
