import { prisma } from "../lib/prisma.js";
import {
  generateOtp,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  verifyOtp,
} from "../lib/auth.js";

export class OtpError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const issueOtp = async (userId: string) => {
  const latest = await prisma.otpVerification.findFirst({
    where: { userId, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new OtpError("Please wait before requesting another code.", 429, "OTP_COOLDOWN");
  }

  await prisma.otpVerification.updateMany({
    where: { userId, verifiedAt: null },
    data: { verifiedAt: new Date() },
  });

  const otp = generateOtp();
  await prisma.otpVerification.create({
    data: {
      userId,
      otpHash: await hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return otp;
};

export const consumeOtp = async (userId: string, otp: string) => {
  const record = await prisma.otpVerification.findFirst({
    where: { userId, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw new OtpError("Invalid or expired verification code.", 400);
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new OtpError("Too many verification attempts.", 429);
  }

  const matches = await verifyOtp(otp, record.otpHash);
  if (!matches) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpError("Invalid or expired verification code.", 400);
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verifiedAt: new Date() },
  });
};
