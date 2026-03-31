function maskEmail(email) {
  const trimmed = String(email || "").trim();
  const [localPart, domain] = trimmed.split("@");
  if (!localPart || !domain) {
    return trimmed;
  }

  const visibleLocal = localPart.slice(0, 2);
  return `${visibleLocal}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`;
}

async function sendEmailWithResend(payload) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.MAIL_FROM_EMAIL || "").trim();

  if (!apiKey || !from) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2>${payload.heading}</h2>
          <p>${payload.message}</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${payload.code}</p>
          <p>This code expires in ${payload.expiresInMinutes} minutes.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}.`);
  }

  return {
    delivered: true,
    provider: "resend",
  };
}

async function sendVerificationEmail(payload) {
  try {
    const result = await sendEmailWithResend(payload);
    if (result) {
      return result;
    }
  } catch (_) {
    // Fall through to preview mode below.
  }

  console.log(`[EMAIL PREVIEW] ${payload.subject} -> ${payload.to}: ${payload.code}`);

  return {
    delivered: false,
    provider: "preview",
    previewCode: payload.code,
  };
}

module.exports = {
  maskEmail,
  sendVerificationEmail,
};
