import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import {
  signedDownloadUrl,
  signedUploadUrl,
  storageReference
} from "../../integrations/object-storage.service";
import { createNotification } from "../notifications/notification.service";

async function profile(userId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new ApiError(404, "DRIVER_NOT_FOUND", "Khong tim thay ho so tai xe");
  return driver;
}

export async function listVehicles(userId: string) {
  const driver = await profile(userId);
  return prisma.vehicle.findMany({
    where: { driverId: driver.id },
    include: { vehicleType: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function createVehicle(userId: string, input: any) {
  const driver = await profile(userId);
  if (input.isActive)
    await prisma.vehicle.updateMany({ where: { driverId: driver.id }, data: { isActive: false } });
  return prisma.vehicle.create({
    data: { ...input, driverId: driver.id, registrationStatus: "PENDING" },
    include: { vehicleType: true }
  });
}

export async function updateVehicle(userId: string, id: string, input: any) {
  const driver = await profile(userId);
  const current = await prisma.vehicle.findFirst({ where: { id, driverId: driver.id } });
  if (!current) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Khong tim thay phuong tien");
  if (input.isActive)
    await prisma.vehicle.updateMany({
      where: { driverId: driver.id, id: { not: id } },
      data: { isActive: false }
    });
  return prisma.vehicle.update({
    where: { id },
    data: { ...input, registrationStatus: "PENDING" },
    include: { vehicleType: true }
  });
}

export async function deleteVehicle(userId: string, id: string) {
  const driver = await profile(userId);
  const deleted = await prisma.vehicle.deleteMany({ where: { id, driverId: driver.id, isActive: false } });
  if (!deleted.count)
    throw new ApiError(409, "VEHICLE_DELETE_BLOCKED", "Chi co the xoa phuong tien khong hoat dong");
  return { deleted: true };
}

export async function listDocuments(userId: string) {
  const driver = await profile(userId);
  return prisma.driverDocument.findMany({ where: { driverId: driver.id }, orderBy: { createdAt: "desc" } });
}

export async function createDocumentUpload(
  userId: string,
  input: { type: string; fileName: string; mimeType: string; fileSize: number; expiresAt?: string }
) {
  const driver = await profile(userId);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `drivers/${driver.id}/${input.type}/${randomUUID()}-${safeName}`;
  const uploadUrl = await signedUploadUrl(key, input.mimeType, input.fileSize);
  const document = await prisma.driverDocument.create({
    data: {
      driverId: driver.id,
      type: input.type,
      fileUrl: storageReference(key),
      objectKey: key,
      originalName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      status: "PENDING"
    }
  });
  return { document, uploadUrl, expiresInSeconds: 900 };
}

export async function documentDownload(userId: string, id: string, staff = false) {
  const document = await prisma.driverDocument.findUnique({ where: { id }, include: { driver: true } });
  if (!document || (!staff && document.driver.userId !== userId))
    throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Khong tim thay tai lieu");
  if (!document.objectKey)
    throw new ApiError(409, "DOCUMENT_NOT_IN_STORAGE", "Tai lieu cu khong co object key");
  return { url: await signedDownloadUrl(document.objectKey), expiresInSeconds: 300 };
}

export async function listAllAssets(
  kind: "documents" | "vehicles",
  query: { status?: string; page: number; limit: number }
) {
  const skip = (query.page - 1) * query.limit;
  if (kind === "documents") {
    await prisma.driverDocument.updateMany({
      where: { expiresAt: { lt: new Date() }, status: "APPROVED" },
      data: { status: "EXPIRED" }
    });
    const where = query.status ? { status: query.status as never } : {};
    const [items, total] = await Promise.all([
      prisma.driverDocument.findMany({
        where,
        include: { driver: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit
      }),
      prisma.driverDocument.count({ where })
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }
  const where = query.status ? { registrationStatus: query.status as never } : {};
  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { driver: { include: { user: true } }, vehicleType: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit
    }),
    prisma.vehicle.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function reviewDocument(
  id: string,
  actorId: string,
  input: { status: "APPROVED" | "REJECTED"; reason?: string }
) {
  const document = await prisma.driverDocument.findUnique({ where: { id }, include: { driver: true } });
  if (!document) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Khong tim thay tai lieu");
  const updated = await prisma.driverDocument.update({
    where: { id },
    data: {
      status: input.status,
      rejectionReason: input.reason,
      reviewedById: actorId,
      reviewedAt: new Date(),
      verifiedAt: input.status === "APPROVED" ? new Date() : null
    }
  });
  await createNotification({
    userId: document.driver.userId,
    title: input.status === "APPROVED" ? "Tài liệu đã được duyệt" : "Tài liệu bị từ chối",
    body: input.reason ?? `Tài liệu ${document.type}: ${input.status}`,
    push: true
  });
  return updated;
}

export async function reviewVehicle(id: string, status: "APPROVED" | "REJECTED") {
  const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { driver: true } });
  if (!vehicle) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Khong tim thay phuong tien");
  const updated = await prisma.vehicle.update({
    where: { id },
    data: { registrationStatus: status, ...(status === "REJECTED" ? { isActive: false } : {}) }
  });
  await createNotification({
    userId: vehicle.driver.userId,
    title: status === "APPROVED" ? "Phương tiện đã được duyệt" : "Phương tiện bị từ chối",
    body: vehicle.plateNumber,
    push: true
  });
  return updated;
}
