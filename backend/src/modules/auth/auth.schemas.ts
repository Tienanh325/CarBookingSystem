import { z } from "zod";

export const registerSchema = z.object({
  phone: z.string().min(9).max(15),
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100)
});

export const loginSchema = z.object({
  phone: z.string().min(9).max(15),
  password: z.string().min(6).max(100)
});

export const sendOtpSchema = z.object({
  phone: z.string().min(9).max(15)
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(9).max(15),
  otp: z.string().length(6)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20)
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(5).max(191)
});

export const resetPasswordSchema = z.object({
  token: z.string().min(40).max(200),
  password: z.string().min(8).max(100)
});
