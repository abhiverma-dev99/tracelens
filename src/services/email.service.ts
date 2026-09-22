import nodemailer from "nodemailer";

const allowConsoleOtp =
  process.env.ALLOW_CONSOLE_OTP === "true" || process.env.NODE_ENV !== "production";

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

const transporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

export const sendVerificationEmail = async (email: string, otp: string) => {
  const from =
    process.env.EMAIL_FROM ||
    (process.env.SMTP_USER ? `TraceLens <${process.env.SMTP_USER}>` : "TraceLens <noreply@tracelens.dev>");
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
    await transporter.sendMail({ from, to: email, subject, text });
    return "smtp" as const;
  } catch (error) {
    console.error("[Email SMTP error]:", error);
    throw new Error("Could not send the verification email. Check SMTP settings.");
  }
};
