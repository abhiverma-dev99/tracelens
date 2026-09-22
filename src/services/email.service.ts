import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const SMTP_TIMEOUT_MS = 15_000;

const allowConsoleOtp =
  process.env.ALLOW_CONSOLE_OTP === "true" || process.env.NODE_ENV !== "production";

const smtpAuth = () => ({
  user: process.env.SMTP_USER?.trim() || "",
  pass: process.env.SMTP_PASSWORD?.replace(/\s/g, "") || "",
});

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

export const getEmailDelivery = () => {
  if (process.env.GMAIL_SCRIPT_URL) return "gmail-script";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  if (isSmtpConfigured()) return "smtp";
  return "console";
};

const senderEmail = () => {
  const from = process.env.EMAIL_FROM?.trim();
  const match = from?.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  if (from?.includes("@")) return from;
  return process.env.SMTP_USER?.trim() || "noreply@tracelens.dev";
};

const senderName = () => {
  const from = process.env.EMAIL_FROM?.trim();
  const match = from?.match(/^(.*)<([^>]+)>/);
  if (match?.[1]?.trim()) return match[1].trim();
  return "TraceLens";
};

const mailText = (otp: string) =>
  `Your TraceLens verification code is ${otp}. It expires in 10 minutes.`;

const sendWithGmailScript = async (email: string, otp: string) => {
  const response = await fetch(process.env.GMAIL_SCRIPT_URL as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({
      secret: process.env.GMAIL_SCRIPT_SECRET || "",
      to: email,
      subject: "Your TraceLens verification code",
      text: mailText(otp),
    }),
  });

  const body = await response.text();
  if (!response.ok || body.includes("unauthorized") || body.includes("error")) {
    throw new Error(`Gmail script ${response.status}: ${body}`);
  }
};

const sendWithResend = async (email: string, otp: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM?.trim() || `${senderName()} <${senderEmail()}>`,
      to: [email],
      subject: "Your TraceLens verification code",
      text: mailText(otp),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body}`);
  }
};

const sendWithBrevo = async (email: string, otp: string) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName(), email: senderEmail() },
      to: [{ email }],
      subject: "Your TraceLens verification code",
      textContent: mailText(otp),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo ${response.status}: ${body}`);
  }
};

const createTransporter = (port: number) =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: port === 465,
    requireTLS: port === 587,
    family: 4,
    auth: smtpAuth(),
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

const sendWithTransporter = async (transporter: Transporter, email: string, otp: string) => {
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (process.env.SMTP_USER
      ? `TraceLens <${process.env.SMTP_USER.trim()}>`
      : "TraceLens <noreply@tracelens.dev>");

  try {
    await Promise.race([
      transporter.sendMail({
        from,
        to: email,
        subject: "Your TraceLens verification code",
        text: mailText(otp),
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("SMTP_TIMEOUT")), SMTP_TIMEOUT_MS + 2000);
      }),
    ]);
  } finally {
    transporter.close();
  }
};

const sendWithSmtp = async (email: string, otp: string) => {
  const preferredPort = Number(process.env.SMTP_PORT) || 587;
  const ports = preferredPort === 465 ? [465, 587] : [587, 465];
  let lastError: unknown;

  for (const port of ports) {
    try {
      await sendWithTransporter(createTransporter(port), email, otp);
      console.log(`[Email]: sent via SMTP port ${port}`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`[Email SMTP error port ${port}]:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("SMTP failed");
};

export const sendVerificationEmail = async (email: string, otp: string) => {
  const channel = getEmailDelivery();

  if (channel === "console") {
    if (!allowConsoleOtp) {
      throw new Error(
        "Email is not configured. Set BREVO_API_KEY or RESEND_API_KEY on Render. Gmail SMTP is blocked from this host.",
      );
    }
    console.log(`[Email fallback]: OTP for ${email}: ${otp}`);
    return "console" as const;
  }

  try {
    if (channel === "gmail-script") {
      await sendWithGmailScript(email, otp);
      return "gmail-script" as const;
    }
    if (channel === "resend") {
      await sendWithResend(email, otp);
      return "resend" as const;
    }
    if (channel === "brevo") {
      await sendWithBrevo(email, otp);
      return "brevo" as const;
    }
    await sendWithSmtp(email, otp);
    return "smtp" as const;
  } catch (error) {
    console.error("[Email send error]:", error);
    if (channel === "smtp") {
      throw new Error(
        "Gmail SMTP is blocked from Render (connection timeout). Add a free BREVO_API_KEY instead.",
      );
    }
    throw new Error("Could not send the verification email. Check the email API key and sender address.");
  }
};
