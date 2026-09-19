import { Prisma, PromotionType, type Promotion } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";

function asNumber(value: unknown) {
  return Number(value);
}

export async function validatePromotionForFare(
  code: string,
  fare: number,
  userId?: string,
  db: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient
) {
  const now = new Date();
  const promotion = await db.promotion.findUnique({
    where: { code: code.trim().toUpperCase() }
  });

  if (!promotion || !promotion.isActive || promotion.startsAt > now || promotion.endsAt < now) {
    throw new ApiError(400, "PROMOTION_INVALID", "Ma khuyen mai khong hop le hoac da het han");
  }

  if (promotion.minRideFare && fare < asNumber(promotion.minRideFare)) {
    throw new ApiError(400, "PROMOTION_MIN_FARE_NOT_MET", "Chuyen di chua dat gia tri toi thieu");
  }

  if (promotion.usageLimit) {
    const usageCount = await db.promotionUsage.count({
      where: { promotionId: promotion.id }
    });
    if (usageCount >= promotion.usageLimit) {
      throw new ApiError(400, "PROMOTION_USAGE_LIMIT_REACHED", "Ma khuyen mai da het luot su dung");
    }
  }

  if (promotion.perUserLimit && userId) {
    const userUsageCount = await db.promotionUsage.count({
      where: {
        promotionId: promotion.id,
        userId
      }
    });
    if (userUsageCount >= promotion.perUserLimit) {
      throw new ApiError(400, "PROMOTION_USER_LIMIT_REACHED", "Ban da dung het luot cho ma nay");
    }
  }

  const discount = calculateDiscount(promotion, fare);

  return {
    promotion,
    discount,
    finalFare: Math.max(0, fare - discount)
  };
}

export function calculateDiscount(promotion: Promotion, fare: number) {
  let discount =
    promotion.type === PromotionType.PERCENTAGE
      ? (fare * asNumber(promotion.value)) / 100
      : asNumber(promotion.value);

  if (promotion.maxDiscount) {
    discount = Math.min(discount, asNumber(promotion.maxDiscount));
  }

  return Math.round(discount);
}

export async function listPromotions() {
  return prisma.promotion.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export async function createPromotion(input: {
  code: string;
  name: string;
  type: PromotionType;
  value: number;
  maxDiscount?: number | null;
  minRideFare?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean;
}) {
  return prisma.promotion.create({
    data: {
      ...input,
      code: input.code.trim().toUpperCase()
    }
  });
}

export async function updatePromotion(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    type: PromotionType;
    value: number;
    maxDiscount: number | null;
    minRideFare: number | null;
    usageLimit: number | null;
    perUserLimit: number | null;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
  }>
) {
  return prisma.promotion.update({
    where: { id },
    data: {
      ...input,
      code: input.code ? input.code.trim().toUpperCase() : undefined
    }
  });
}
