import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  logoutController,
  meController,
  refreshController,
  resendOtpController,
  signinController,
  signupController,
  verifyOtpController,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Try again later." },
});

const router = Router();

router.post("/signup", authLimiter, signupController);
router.post("/signin", authLimiter, signinController);
router.post("/verify-otp", otpLimiter, verifyOtpController);
router.post("/resend-otp", otpLimiter, resendOtpController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);
router.get("/me", authMiddleware, meController);

export default router;
