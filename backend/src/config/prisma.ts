import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  omit: { user: { passwordHash: true } },
  log: ["error", "warn"]
});
