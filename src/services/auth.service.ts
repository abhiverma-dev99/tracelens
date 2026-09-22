import type { CookieOptions, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  generateRefreshToken,
  getRefreshCookieOptions,
  hashPassword,
  hashToken,
  REFRESH_COOKIE,
  REFRESH_TTL_MS_VALUE,
  signAccessToken,
  verifyPassword,
} from "../lib/auth.js";
import { sendVerificationEmail } from "./email.service.js";
import { consumeOtp, issueOtp, OtpError } from "./otp.service.js";

export class AuthError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateSignup = (name: unknown, email: unknown, password: unknown) => {
  if (typeof name !== "string" || name.trim().length < 2) {
    throw new AuthError("Name must be at least 2 characters.", 422);
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    throw new AuthError("A valid email is required.", 422);
  }
  if (typeof password !== "string" || password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", 422);
  }
};

const publicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
});

const publicProject = (project: { id: string; name: string; ingestKey: string }) => ({
  id: project.id,
  name: project.name,
  ingestKey: project.ingestKey,
});

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, getRefreshCookieOptions() as CookieOptions);
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  } as CookieOptions);
};

const createSession = async (user: { id: string; email: string }, res: Response) => {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS_VALUE),
    },
  });

  setRefreshCookie(res, refreshToken);
  return accessToken;
};

const ensureProject = async (userId: string, name: string | null) => {
  const existing = await prisma.project.findFirst({ where: { userId } });
  if (existing) return existing;

  const projectName = name?.trim() ? `${name.trim()}'s Project` : "My Project";
  return prisma.project.create({
    data: { name: projectName, userId },
  });
};

export const signup = async (input: { name: unknown; email: unknown; password: unknown }) => {
  validateSignup(input.name, input.email, input.password);
  const name = (input.name as string).trim();
  const email = normalizeEmail(input.email as string);
  const password = input.password as string;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("An account with this email already exists.", 409);
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      emailVerified: false,
    },
  });

  const otp = await issueOtp(user.id);
  let delivery: "smtp" | "console";
  try {
    delivery = await sendVerificationEmail(user.email, otp);
  } catch (error) {
    throw new AuthError(
      error instanceof Error ? error.message : "Could not send the verification email.",
      503,
    );
  }

  return {
    message:
      delivery === "console"
        ? "Account created. SMTP is not configured, so the verification code was printed in the API server terminal."
        : "Account created. Check your email for a verification code.",
    email: user.email,
    delivery,
  };
};

export const verifyOtpAndLogin = async (
  input: { email: unknown; otp: unknown },
  res: Response,
) => {
  if (typeof input.email !== "string" || typeof input.otp !== "string") {
    throw new AuthError("Email and OTP are required.", 422);
  }

  const email = normalizeEmail(input.email);
  const otp = input.otp.trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new AuthError("Invalid or expired verification code.", 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError("Invalid or expired verification code.", 400);
  }

  try {
    await consumeOtp(user.id, otp);
  } catch (error) {
    if (error instanceof OtpError) {
      throw new AuthError(error.message, error.status, error.code);
    }
    throw error;
  }

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
  });

  const project = await ensureProject(verified.id, verified.name);
  const accessToken = await createSession(verified, res);

  return {
    accessToken,
    user: publicUser(verified),
    project: publicProject(project),
  };
};

export const resendOtp = async (input: { email: unknown }) => {
  if (typeof input.email !== "string") {
    throw new AuthError("Email is required.", 422);
  }

  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.emailVerified) {
    try {
      const otp = await issueOtp(user.id);
      let delivery: "smtp" | "console";
      try {
        delivery = await sendVerificationEmail(user.email, otp);
      } catch (error) {
        throw new AuthError(
          error instanceof Error ? error.message : "Could not send the verification email.",
          503,
        );
      }
      return {
        message:
          delivery === "console"
            ? "A new code was printed in the API server terminal."
            : "If an unverified account exists, a new code was sent.",
        delivery,
      };
    } catch (error) {
      if (error instanceof OtpError) {
        throw new AuthError(error.message, error.status, error.code);
      }
      throw error;
    }
  }

  return { message: "If an unverified account exists, a new code was sent." };
};

export const signin = async (
  input: { email: unknown; password: unknown },
  res: Response,
) => {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    throw new AuthError("Email and password are required.", 422);
  }

  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  const dummyHash = "$2b$12$R0/SFDCkWZ.XF0UnCWtc3eHxXnr9/.38Bw4l6VkvNgu6iNHpwRYUO";
  const hash = user?.passwordHash || dummyHash;
  const matches = await verifyPassword(input.password, hash);

  if (!user || !user.passwordHash || !matches) {
    throw new AuthError("Invalid email or password.", 401);
  }

  if (!user.emailVerified) {
    throw new AuthError("Email verification is required.", 403, "OTP_REQUIRED");
  }

  const project = await ensureProject(user.id, user.name);
  const accessToken = await createSession(user, res);

  return {
    accessToken,
    user: publicUser(user),
    project: publicProject(project),
  };
};

export const refreshSession = async (refreshToken: string | undefined, res: Response) => {
  if (!refreshToken) {
    throw new AuthError("Authentication required.", 401);
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !stored ||
    stored.revokedAt ||
    stored.expiresAt.getTime() < Date.now() ||
    !stored.user.emailVerified
  ) {
    clearRefreshCookie(res);
    throw new AuthError("Authentication required.", 401);
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const project = await ensureProject(stored.user.id, stored.user.name);
  const accessToken = await createSession(stored.user, res);

  return {
    accessToken,
    user: publicUser(stored.user),
    project: publicProject(project),
  };
};

export const logout = async (refreshToken: string | undefined, res: Response) => {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken) },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { projects: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  if (!user) {
    throw new AuthError("Authentication required.", 401);
  }

  const project = user.projects[0];
  return {
    user: publicUser(user),
    project: project ? publicProject(project) : null,
  };
};
