import nodemailer from "nodemailer";

const hasSmtp = Boolean(process.env.SMTP_HOST);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
    })
  : null;

export const sendVerificationEmail = async (email: string, otp: string) => {
  const from = process.env.EMAIL_FROM || "TraceLens <noreply@tracelens.dev>";
  const subject = "Your TraceLens verification code";
  const text = `Your TraceLens verification code is ${otp}. It expires in 10 minutes.`;

  if (!transporter) {
    console.log(`[Email fallback]: OTP for ${email}: ${otp}`);
    return "console" as const;
  }

  await transporter.sendMail({ from, to: email, subject, text });
  return "smtp" as const;
};
