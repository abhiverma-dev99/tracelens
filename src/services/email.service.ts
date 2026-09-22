import nodemailer from "nodemailer";

const SMTP_TIMEOUT_MS = 12_000;

const allowConsoleOtp =
  process.env.ALLOW_CONSOLE_OTP === "true" || process.env.NODE_ENV !== "production";

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

const createTransporter = () => {
  if (!isSmtpConfigured()) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASSWORD?.replace(/\s/g, ""),
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
};

export const sendVerificationEmail = async (email: string, otp: string) => {
  const transporter = createTransporter();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (process.env.SMTP_USER
      ? `TraceLens <${process.env.SMTP_USER.trim()}>`
      : "TraceLens <noreply@tracelens.dev>");
  const subject = "Your TraceLens verification code";
  const text = `Your TraceLens verification code is ${otp}. It expires in 10 minutes.`;

  if (!transporter) {
    if (!allowConsoleOtp) {
      throw new Error(
        "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD on the API host.",
      );
    }
    console.log(`[Email fallback]: OTP for ${email}: ${otp}`);
    return "console" as const;
  }

  try {
    await Promise.race([
      transporter.sendMail({ from, to: email, subject, text }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("SMTP_TIMEOUT")), SMTP_TIMEOUT_MS + 2000);
      }),
    ]);
    return "smtp" as const;
  } catch (error) {
    console.error("[Email SMTP error]:", error);
    throw new Error(
      "Could not send the verification email. Check SMTP_HOST, SMTP_PORT, and the Gmail App Password.",
    );
  } finally {
    transporter.close();
  }
};
