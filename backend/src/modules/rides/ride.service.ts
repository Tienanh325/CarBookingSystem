import { Prisma, type PaymentMethod, type RideStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type { RoleName } from "../../utils/roles";
import { estimateRide } from "../pricing/pricing.service";
import { notifyRide } from "../../realtime/socket";

export const activeRideStatuses: RideStatus[] = ["REQUESTED","SEARCHING_DRIVER","ACCEPTED","DRIVER_ARRIVING","ARRIVED","IN_PROGRESS"];
export const visibleRideStatuses: RideStatus[] = ["SCHEDULED", ...activeRideStatuses];
export const contactSelect = { id:true, fullName:true, phone:true, avatarUrl:true } as const;
export const rideInclude = {
  customer: { select: contactSelect },
  driver: { select: { id:true, userId:true, ratingAvg:true, user:{select:contactSelect}, location:true, vehicles:{ where:{ isActive:true }, include:{ vehicleType:true } } } },
  vehicleType:true, payment:true, rating:true, stops:{orderBy:{orderIndex:"asc"}}, statusLogs:{orderBy:{createdAt:"asc"}}
} satisfies Prisma.RideInclude;
type Point = { address:string; lat:number; lng:number };
type Stop = Point & { dwellMinutes?:number };
type Input = { pickup:Point; dropoff:Point; stops?:Stop[]; vehicleTypeId:string; promotionCode?:string; paymentMethod:PaymentMethod; scheduledAt?:Date };
export async function createRide(customerId:string, input:Input) {
  if(input.paymentMethod !== "CASH") throw new ApiError(422,"PAYMENT_NOT_CONFIGURED","Hien tai chi ho tro tien mat");
  const now = new Date();
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  if (scheduledAt && scheduledAt.getTime() < now.getTime() + 10 * 60_000) throw new ApiError(422,"SCHEDULE_TOO_SOON","Thoi gian hen phai cach hien tai it nhat 10 phut");
  if (scheduledAt && scheduledAt.getTime() > now.getTime() + 30 * 24 * 60 * 60_000) throw new ApiError(422,"SCHEDULE_TOO_FAR","Chi co the dat truoc toi da 30 ngay");
  const status: RideStatus = scheduledAt ? "SCHEDULED" : "SEARCHING_DRIVER";
  const ride = await prisma.$transaction(async tx => {
    // Lock this customer's row to serialize simultaneous booking attempts.
    await tx.user.update({where:{id:customerId},data:{updatedAt:new Date()}});
    if(await tx.ride.findFirst({where:{customerId,status:{in:visibleRideStatuses}}})) throw new ApiError(409,"RIDE_ACTIVE_EXISTS","Ban dang co chuyen hoat dong hoac lich hen sap toi");
    if(input.promotionCode) {
      const promo = await tx.promotion.findUnique({where:{code:input.promotionCode.trim().toUpperCase()}});
      if(promo) await tx.promotion.update({where:{id:promo.id},data:{updatedAt:new Date()}});
    }
    const estimate = await estimateRide(input,customerId,tx);
    const created = await tx.ride.create({data:{customerId,vehicleTypeId:input.vehicleTypeId,pickupAddress:input.pickup.address,pickupLat:input.pickup.lat,pickupLng:input.pickup.lng,dropoffAddress:input.dropoff.address,dropoffLat:input.dropoff.lat,dropoffLng:input.dropoff.lng,estimatedDistanceKm:estimate.distanceKm,estimatedDurationMin:estimate.durationMin,estimatedFare:estimate.finalFare,stopFee:estimate.stopFee,promotionId:estimate.promotionId,paymentMethod:"CASH",status,scheduledAt,matchingStartedAt:scheduledAt?undefined:now,routeGeometry:estimate.routeGeometry,routeProvider:estimate.routeProvider,stops:{create:(input.stops??[]).map((stop,index)=>({orderIndex:index,address:stop.address,lat:stop.lat,lng:stop.lng,dwellMinutes:stop.dwellMinutes??5,fee:(stop.dwellMinutes??5)*Number(estimate.stopFee/(input.stops?.reduce((sum,item)=>sum+(item.dwellMinutes??5),0)||1))}))},statusLogs:{create:{toStatus:status,changedById:customerId}}},include:rideInclude});
    if(estimate.promotionId) await tx.promotionUsage.create({data:{promotionId:estimate.promotionId,userId:customerId,rideId:created.id,discount:estimate.discount}});
    return created;
  }, {isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  await notifyRide(ride.id, status === "SCHEDULED" ? "ride.scheduled" : "ride.request.created");
  return ride;
}
export async function estimateRideForCustomer(customerId:string,input:Omit<Input,"paymentMethod">) {return estimateRide(input,customerId);}
type RideScope = "customer" | "driver";
async function getRideOwnerWhere(userId:string,roles:RoleName[],scope?:RideScope) {
  const selectedScope=scope??(roles.includes("DRIVER")?"driver":"customer");
  if(selectedScope==="driver") {
    if(!roles.includes("DRIVER")) throw new ApiError(403,"ROLE_REQUIRED","Tai khoan khong co vai tro tai xe");
    const driver=await prisma.driverProfile.findUnique({where:{userId},select:{id:true}});
    if(!driver) throw new ApiError(404,"DRIVER_NOT_FOUND","Khong tim thay ho so tai xe");
    return {driverId:driver.id};
  }
  if(!roles.includes("CUSTOMER")) throw new ApiError(403,"ROLE_REQUIRED","Tai khoan khong co vai tro khach hang");
  return {customerId:userId};
}
export async function getCurrentRide(userId:string,roles:RoleName[],scope?:RideScope) {
  const owner=await getRideOwnerWhere(userId,roles,scope);
  return prisma.ride.findFirst({where:{...owner,status:{in:visibleRideStatuses}},include:rideInclude,orderBy:{requestedAt:"desc"}});
}
export async function listRides(userId:string,roles:RoleName[],scope?:RideScope) {
  const owner=await getRideOwnerWhere(userId,roles,scope);
  return prisma.ride.findMany({where:owner,include:rideInclude,orderBy:{requestedAt:"desc"},take:100});
}
export async function getRideById(id:string,userId:string,roles:RoleName[]) {
  const ride = await prisma.ride.findUnique({where:{id},include:rideInclude});
  if(!ride) throw new ApiError(404,"RIDE_NOT_FOUND","Khong tim thay chuyen");
  if(!roles.some(r=>["ADMIN","OPERATOR","SUPPORT","ACCOUNTANT"].includes(r)) && ride.customerId!==userId && ride.driver?.userId!==userId) throw new ApiError(403,"RIDE_ACCESS_DENIED","Khong co quyen xem chuyen");
  return ride;
}
export async function cancelRideByCustomer(id:string,customerId:string,reason:string) {
  const cancelled = await prisma.$transaction(async tx=>{
    const ride=await tx.ride.findFirst({where:{id,customerId}});
    if(!ride) throw new ApiError(404,"RIDE_NOT_FOUND","Khong tim thay chuyen");
    const changed=await tx.ride.updateMany({where:{id,customerId,status:{in:["SCHEDULED","SEARCHING_DRIVER","ACCEPTED","DRIVER_ARRIVING","ARRIVED"]}},data:{status:"CANCELLED_BY_CUSTOMER",cancelledAt:new Date(),cancelReason:reason}});
    if(!changed.count) throw new ApiError(409,"RIDE_INVALID_STATUS","Khong the huy chuyen");
    if(ride.driverId) await tx.driverProfile.update({where:{id:ride.driverId},data:{onlineStatus:"ONLINE"}});
    await tx.rideStatusLog.create({data:{rideId:id,fromStatus:ride.status,toStatus:"CANCELLED_BY_CUSTOMER",changedById:customerId,note:reason}});
    await tx.promotionUsage.deleteMany({where:{rideId:id}});
    await tx.driverOffer.updateMany({where:{rideId:id,status:"PENDING"},data:{status:"CANCELLED",respondedAt:new Date()}});
    return tx.ride.findUniqueOrThrow({where:{id},include:rideInclude});
  });
  await notifyRide(id,"ride.cancelled"); return cancelled;
}
export async function rateRide(id:string,customerId:string,input:{score:number;comment?:string}) {
  const ride=await prisma.ride.findFirst({where:{id,customerId,status:"COMPLETED"},include:{driver:true}});
  if(!ride?.driver) throw new ApiError(409,"RIDE_NOT_COMPLETED","Chi danh gia chuyen da hoan thanh");
  return prisma.$transaction(async tx=>{
    const rating=await tx.rating.create({data:{rideId:id,fromUserId:customerId,toUserId:ride.driver!.userId,...input}});
    const aggregate=await tx.rating.aggregate({where:{toUserId:ride.driver!.userId},_avg:{score:true}});
    await tx.driverProfile.update({where:{id:ride.driverId!},data:{ratingAvg:aggregate._avg.score??5}});
    return rating;
  });
}
