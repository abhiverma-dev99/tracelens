import type { Request, Response } from "express";
import { REFRESH_COOKIE } from "../lib/auth.js";
import {
  AuthError,
  getMe,
  logout,
  refreshSession,
  resendOtp,
  signin,
  signup,
  verifyOtpAndLogin,
} from "../services/auth.service.js";

const handleAuthError = (res: Response, error: unknown) => {
  if (error instanceof AuthError) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }

  console.error("[Auth Error]:", error);
  return res.status(500).json({ error: "Internal server error." });
};

export const signupController = async (req: Request, res: Response) => {
  try {
    const data = await signup(req.body);
    return res.status(201).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const data = await verifyOtpAndLogin(req.body, res);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const resendOtpController = async (req: Request, res: Response) => {
  try {
    const data = await resendOtp(req.body);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const signinController = async (req: Request, res: Response) => {
  try {
    const data = await signin(req.body, res);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const refreshController = async (req: Request, res: Response) => {
  try {
    const data = await refreshSession(req.cookies?.[REFRESH_COOKIE], res);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    await logout(req.cookies?.[REFRESH_COOKIE], res);
    return res.status(200).json({ status: "success", data: { message: "Signed out." } });
  } catch (error) {
    return handleAuthError(res, error);
  }
};

export const meController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const data = await getMe(req.user.id);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleAuthError(res, error);
  }
};
