import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const SMTP_TIMEOUT_MS = 15_000;

const allowConsoleOtp =
  process.env.ALLOW_CONSOLE_OTP === "true" || process.env.NODE_ENV !== "production";

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

const smtpAuth = () => ({
  user: process.env.SMTP_USER?.trim() || "",
  pass: process.env.SMTP_PASSWORD?.replace(/\s/g, "") || "",
});

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

const mailErrorMessage = (error: unknown) => {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (text.includes("EAUTH") || text.includes("Invalid login") || text.includes("Username and Password not accepted")) {
    return "Gmail rejected the login. SMTP_PASSWORD must be the 16-character App Password for SMTP_USER.";
  }
  if (text.includes("SMTP_TIMEOUT") || text.includes("ETIMEDOUT") || text.includes("ECONNECTION") || text.includes("Greeting never received")) {
    return "The server could not reach Gmail SMTP. Render will retry port 465 automatically on the next request.";
  }
  return "Could not send the verification email.";
};

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
        text: `Your TraceLens verification code is ${otp}. It expires in 10 minutes.`,
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("SMTP_TIMEOUT")), SMTP_TIMEOUT_MS + 2000);
      }),
    ]);
  } finally {
    transporter.close();
  }
};

export const sendVerificationEmail = async (email: string, otp: string) => {
  if (!isSmtpConfigured()) {
    if (!allowConsoleOtp) {
      throw new Error(
        "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD on the API host.",
      );
    }
    console.log(`[Email fallback]: OTP for ${email}: ${otp}`);
    return "console" as const;
  }

  const preferredPort = Number(process.env.SMTP_PORT) || 587;
  const ports = preferredPort === 465 ? [465, 587] : [587, 465];
  let lastError: unknown;

  for (const port of ports) {
    try {
      await sendWithTransporter(createTransporter(port), email, otp);
      console.log(`[Email]: sent via SMTP port ${port}`);
      return "smtp" as const;
    } catch (error) {
      lastError = error;
      console.error(`[Email SMTP error port ${port}]:`, error);
    }
  }

  throw new Error(mailErrorMessage(lastError));
};
