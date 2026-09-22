import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

export type AccessPayload = {
  sub: string;
  email: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
};

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const hashOtp = (otp: string) => bcrypt.hash(otp, BCRYPT_ROUNDS);

export const verifyOtp = (otp: string, hash: string) => bcrypt.compare(otp, hash);

export const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateRefreshToken = () => crypto.randomBytes(32).toString("hex");

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TTL });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, getJwtSecret()) as AccessPayload;

export const getRefreshCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/api/auth",
    maxAge: REFRESH_TTL_MS,
  };
};

export const REFRESH_COOKIE = "tl_refresh";
export const REFRESH_TTL_MS_VALUE = REFRESH_TTL_MS;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
