import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import type { RoleName } from "../../utils/roles";
import { Prisma } from "@prisma/client";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function durationMs(value: string, fallback: number) {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallback;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 } as const;
  return Number(match[1]) * units[match[2] as keyof typeof units];
}
async function publicUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
    }
  });
  if (!user || user.status !== "ACTIVE")
    throw new ApiError(401, "AUTH_USER_INACTIVE", "Tai khoan khong kha dung");
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    status: user.status,
    roles: user.roles.map((r) => r.role.name as RoleName),
    permissions: [
      ...new Set(user.roles.flatMap((r) => r.role.permissions.map((item) => item.permission.key)))
    ]
  };
}
async function issue(userId: string) {
  const user = await publicUser(userId);
  const id = randomUUID();
  const refreshToken = id + "." + randomBytes(32).toString("hex");
  await prisma.authSession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.authSession.create({
    data: {
      id,
      userId,
      refreshHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + durationMs(env.jwtRefreshExpiresIn, 7 * 86400000))
    }
  });
  return {
    user,
    tokens: {
      accessToken: jwt.sign({ sid: id }, env.jwtAccessSecret, {
        subject: userId,
        expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"]
      }),
      refreshToken
    }
  };
}
export async function authenticate(token: string) {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.sid !== "string") throw new Error();
    const session = await prisma.authSession.findUnique({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub || session.expiresAt < new Date()) throw new Error();
    const user = await publicUser(payload.sub);
    return { userId: user.id, roles: user.roles, sessionId: session.id, expiresAt: payload.exp! * 1000 };
  } catch {
    throw new ApiError(401, "AUTH_INVALID_TOKEN", "Phien dang nhap da het han");
  }
}
export async function registerCustomer(input: {
  phone: string;
  fullName: string;
  email?: string;
  password: string;
}) {
  const phone = input.phone.trim();
  const email = input.email?.trim().toLowerCase();
  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
    select: { phone: true, email: true }
  });
  if (duplicate) {
    const emailExists = Boolean(email && duplicate.email === email);
    throw new ApiError(
      409,
      emailExists ? "EMAIL_ALREADY_EXISTS" : "PHONE_ALREADY_EXISTS",
      emailExists ? "Email da duoc su dung" : "So dien thoai da duoc su dung"
    );
  }
  const role = await prisma.role.upsert({
    where: { name: "CUSTOMER" },
    create: { name: "CUSTOMER", label: "Khach hang" },
    update: {}
  });
  try {
    const user = await prisma.user.create({
      data: {
        phone,
        fullName: input.fullName,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        roles: { create: { roleId: role.id } },
        customerProfile: { create: {} }
      }
    });
    return issue(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "ACCOUNT_ALREADY_EXISTS", "So dien thoai hoac email da duoc su dung");
    }
    throw error;
  }
}
export async function login(input: { phone: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { phone: input.phone.trim() },
    omit: { passwordHash: false }
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.passwordHash ||
    !(await bcrypt.compare(input.password, user.passwordHash))
  )
    throw new ApiError(401, "AUTH_INVALID_CREDENTIALS", "So dien thoai hoac mat khau khong dung");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return issue(user.id);
}
export async function refreshToken(token: string) {
  const id = token.split(".")[0];
  const session = await prisma.authSession.findUnique({ where: { id } });
  if (!session || session.refreshHash !== hash(token) || session.expiresAt < new Date())
    throw new ApiError(401, "AUTH_INVALID_REFRESH_TOKEN", "Phien dang nhap da het han");
  const user = await publicUser(session.userId);
  return {
    user,
    tokens: {
      accessToken: jwt.sign({ sid: id }, env.jwtAccessSecret, {
        subject: user.id,
        expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"]
      }),
      refreshToken: token
    }
  };
}
export async function logout(sessionId: string) {
  await prisma.authSession.deleteMany({ where: { id: sessionId } });
}

export async function requestPasswordReset(identifierInput: string) {
  const identifier = identifierInput.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ phone: identifierInput.trim() }, { email: identifier }]
    },
    select: { id: true, phone: true, email: true }
  });

  if (!user) return { accepted: true };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60_000);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt }
    })
  ]);

  if (env.passwordResetWebhookUrl) {
    try {
      const response = await fetch(env.passwordResetWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.passwordResetWebhookToken
            ? { Authorization: `Bearer ${env.passwordResetWebhookToken}` }
            : {})
        },
        body: JSON.stringify({
          userId: user.id,
          phone: user.phone,
          email: user.email,
          resetToken: token,
          expiresAt: expiresAt.toISOString()
        }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`reset delivery returned ${response.status}`);
    } catch {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash: hash(token) } });
      return { accepted: true };
    }
  }

  return {
    accepted: true,
    ...(env.nodeEnv === "production" ? {} : { resetToken: token, expiresAt })
  };
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hash(token);
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { status: true } } }
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.user.status !== "ACTIVE") {
    throw new ApiError(
      422,
      "PASSWORD_RESET_TOKEN_INVALID",
      "Ma dat lai mat khau khong hop le hoac da het han"
    );
  }

  const sessionIds = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });
    if (!claimed.count) {
      throw new ApiError(409, "PASSWORD_RESET_TOKEN_USED", "Ma dat lai mat khau da duoc su dung");
    }
    const sessions = await tx.authSession.findMany({
      where: { userId: reset.userId },
      select: { id: true }
    });
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await bcrypt.hash(password, 12) }
    });
    await tx.authSession.deleteMany({ where: { userId: reset.userId } });
    return sessions.map((session) => session.id);
  });

  return { sessionIds };
}
export async function sendOtp(_phone: string): Promise<never> {
  throw new ApiError(503, "OTP_NOT_CONFIGURED", "SMS chua duoc cau hinh. Vui long dung mat khau.");
}
export async function verifyOtp(_phone: string, _otp: string): Promise<never> {
  throw new ApiError(503, "OTP_NOT_CONFIGURED", "SMS chua duoc cau hinh. Vui long dung mat khau.");
}
