import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";
import rateLimit from "express-rate-limit";
import * as controller from "./auth.controller";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema
} from "./auth.schemas";

export const authRouter = Router();
authRouter.use(
  rateLimit({
    windowMs: 60000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code: "AUTH_RATE_LIMITED", message: "Qua nhieu yeu cau dang nhap. Vui long thu lai sau." }
      })
  })
);

authRouter.post("/register", validate({ body: registerSchema }), controller.register);
authRouter.post("/login", validate({ body: loginSchema }), controller.login);
authRouter.post("/send-otp", validate({ body: sendOtpSchema }), controller.sendOtp);
authRouter.post("/verify-otp", validate({ body: verifyOtpSchema }), controller.verifyOtp);
authRouter.post("/refresh-token", validate({ body: refreshTokenSchema }), controller.refreshToken);
authRouter.post("/logout", requireAuth, controller.logout);
