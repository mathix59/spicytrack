type EmailContent = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

/** Shared email-safe layout: inline styles, table structure, a public PNG brand icon. */
export function renderEmail(input: {
  subject: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  note?: string;
}): EmailContent {
  if (input.action && !["https:", "http:"].includes(new URL(input.action.url).protocol)) {
    throw new Error("Email action must use an HTTP or HTTPS URL");
  }
  const escape = escapeHtml;
  const action = input.action;
  const text = [
    input.title,
    ...input.paragraphs,
    action ? `${action.label}: ${action.url}` : null,
    input.note,
    "SpicyTrack — Keep your errors in sight.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(input.subject)}</title></head>
<body style="margin:0;padding:0;background-color:#111113;color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escape(input.paragraphs[0] ?? input.title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#111113"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
<tr><td style="padding:0 0 24px;font-size:22px;font-weight:700;letter-spacing:-1px;color:#f4f4f5;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="40" valign="middle"><img src="https://spicytrack.io/favicon-96x96.png" width="32" height="32" alt="" style="display:block;border:0;width:32px;height:32px;"></td><td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-1px;color:#f4f4f5;">SpicyTrack</td></tr></table></td></tr>
<tr><td style="height:4px;background-color:#7c5cfc;border-radius:12px 12px 0 0;"></td></tr>
<tr><td bgcolor="#1b1b20" style="padding:36px 28px;border:1px solid #303039;border-top:0;border-radius:0 0 12px 12px;">
<p style="margin:0 0 18px;font-size:11px;line-height:18px;letter-spacing:2px;font-weight:700;color:#b4a6ff;">${escape(input.eyebrow.toUpperCase())}</p>
<h1 style="margin:0 0 22px;font-size:30px;line-height:38px;letter-spacing:-1px;font-weight:700;color:#ffffff;overflow-wrap:anywhere;">${escape(input.title)}</h1>
${input.paragraphs.map((paragraph) => `<p style="margin:0 0 18px;font-size:15px;line-height:25px;color:#c7c7d1;white-space:pre-wrap;overflow-wrap:anywhere;">${escape(paragraph)}</p>`).join("\n")}
${action ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;"><tr><td bgcolor="#7050e8" style="border-radius:8px;mso-padding-alt:16px 24px;"><a href="${escape(action.url)}" style="display:inline-block;padding:16px 24px;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;color:#ffffff;border:1px solid #967cf8;border-radius:8px;">${escape(action.label)} &rarr;</a></td></tr></table>` : ""}
${input.note ? `<p style="margin:24px 0 0;padding-top:22px;border-top:1px solid #34343e;font-size:13px;line-height:21px;color:#a4a4b3;">${escape(input.note)}</p>` : ""}
</td></tr>
${action ? `<tr><td style="padding:24px 4px 0;"><p style="margin:0 0 8px;font-size:12px;line-height:20px;color:#a4a4b3;">Button not working? Copy and paste this link into your browser:</p><a href="${escape(action.url)}" style="font-size:12px;line-height:20px;color:#b4a6ff;word-break:break-all;overflow-wrap:anywhere;">${escape(action.url)}</a></td></tr>` : ""}
<tr><td style="padding:28px 4px 0;font-size:12px;line-height:20px;color:#8f8f9e;">SpicyTrack<br>Keep your errors in sight.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: input.subject, text, html };
}

export function invitationEmail(url: string, organization: string, role: string): EmailContent {
  return renderEmail({
    subject: "You're invited to join a team on SpicyTrack",
    eyebrow: "Team invitation",
    title: "Great teams fix things together.",
    paragraphs: [
      `You've been invited to join ${organization} on SpicyTrack. Your role: ${role}.`,
      "Join your team to track errors, investigate issues, and keep your applications running smoothly.",
      "Create an account or sign in with the email address that received this invitation.",
    ],
    action: { label: "Accept invitation", url },
    note: "This invitation is valid for 7 days. If you weren't expecting it, you can ignore this email.",
  });
}

export function passwordResetEmail(url: string): EmailContent {
  return renderEmail({
    subject: "Reset your SpicyTrack password",
    eyebrow: "Account security",
    title: "Let's get you back in.",
    paragraphs: [
      "We received a request to reset the password for your SpicyTrack account.",
      "Choose a new password using the button below.",
    ],
    action: { label: "Reset password", url },
    note: "If you didn't request this, you can safely ignore this email. Your password will stay the same. If the link has expired, request a new one from the sign-in page.",
  });
}

export function verificationEmail(url: string): EmailContent {
  return renderEmail({
    subject: "Verify your SpicyTrack email address",
    eyebrow: "Welcome to SpicyTrack",
    title: "One click. You're on track.",
    paragraphs: [
      "Thanks for signing up for SpicyTrack.",
      "Verify your email address to finish setting up your account and start tracking what matters.",
    ],
    action: { label: "Verify email address", url },
    note: "If you didn't create a SpicyTrack account, you can ignore this email.",
  });
}

export function smtpTestEmail(): EmailContent {
  return renderEmail({
    subject: "SpicyTrack test email",
    eyebrow: "Email delivery",
    title: "Your SMTP settings work.",
    paragraphs: [
      "An instance administrator sent this test email from the SpicyTrack instance administration page.",
      "Invitations, password resets and email verification will be delivered with the same settings.",
    ],
    note: "You received this because you requested a test email. No action is needed.",
  });
}
