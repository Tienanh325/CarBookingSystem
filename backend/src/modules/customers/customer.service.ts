import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customerProfile: true,
      roles: { include: { role: true } }
    }
  });

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "Khong tim thay nguoi dung");
  }

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    roles: user.roles.map((item) => item.role.name),
    customerProfile: user.customerProfile
  };
}

export async function updateMe(
  userId: string,
  input: {
    fullName?: string;
    email?: string | null;
    avatarUrl?: string | null;
  }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input
  });

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    status: user.status
  };
}

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createAddress(
  userId: string,
  input: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  }
) {
  return prisma.address.create({
    data: {
      userId,
      label: input.label,
      address: input.address,
      lat: input.lat,
      lng: input.lng
    }
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId
    }
  });

  if (!address) {
    throw new ApiError(404, "ADDRESS_NOT_FOUND", "Khong tim thay dia chi");
  }

  await prisma.address.delete({ where: { id: addressId } });
  return { deleted: true };
}
