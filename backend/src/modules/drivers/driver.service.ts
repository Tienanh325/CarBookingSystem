import { Prisma, type RideStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { emitAdmin, emitToRide, notifyRide } from "../../realtime/socket";
import { activeRideStatuses, rideInclude } from "../rides/ride.service";
import { dispatchRide } from "../matching/matching.service";

export async function getMe(userId:string) {
  const driver=await prisma.driverProfile.findUnique({where:{userId},include:{user:true,vehicles:{include:{vehicleType:true}},location:true,wallet:true}});
  if(!driver) throw new ApiError(404,"DRIVER_PROFILE_NOT_FOUND","Chua co ho so tai xe");
  return driver;
}
export async function registerDriver(userId:string,input:{licenseNumber:string;identityNumber:string;vehicle:{vehicleTypeId:string;plateNumber:string;brand?:string;model?:string;color?:string}}) {
  const result=await prisma.$transaction(async tx=>{
    const existing=await tx.driverProfile.findUnique({where:{userId}});
    if(existing) throw new ApiError(409,"DRIVER_PROFILE_EXISTS","Ho so da ton tai");
    const role=await tx.role.upsert({where:{name:"DRIVER"},create:{name:"DRIVER",label:"Tai xe"},update:{}});
    await tx.userRole.upsert({where:{userId_roleId:{userId,roleId:role.id}},create:{userId,roleId:role.id},update:{}});
    return tx.driverProfile.create({data:{userId,licenseNumber:input.licenseNumber,identityNumber:input.identityNumber,vehicles:{create:input.vehicle},wallet:{create:{}}},include:{vehicles:{include:{vehicleType:true}}}});
  });
  emitAdmin(); return result;
}
export async function updateMe(userId:string,input:{licenseNumber?:string;identityNumber?:string}) {
  const driver=await getMe(userId);
  if(driver.onlineStatus==="BUSY") throw new ApiError(409,"DRIVER_BUSY","Hay hoan thanh chuyen truoc");
  const result=await prisma.driverProfile.update({where:{id:driver.id},data:{...input,verificationStatus:"PENDING",onlineStatus:"OFFLINE"}});
  emitAdmin();return result;
}
export async function setOnline(userId:string,online:boolean) {
  const result=await prisma.$transaction(async tx=>{
    const driver=await tx.driverProfile.findUnique({where:{userId},include:{vehicles:true,location:true}});
    if(!driver) throw new ApiError(404,"DRIVER_PROFILE_NOT_FOUND","Chua co ho so");
    if(online && (driver.verificationStatus!=="APPROVED" || !driver.vehicles.some(v=>v.isActive&&v.registrationStatus==="APPROVED"))) throw new ApiError(403,"DRIVER_NOT_APPROVED","Ho so va xe chua duoc duyet");
    if(online && (!driver.location || Date.now()-driver.location.updatedAt.getTime()>2*60_000)) throw new ApiError(422,"DRIVER_LOCATION_REQUIRED","Hay bat chia se GPS truoc khi Online");
    const changed=await tx.driverProfile.updateMany({where:{id:driver.id,onlineStatus:{not:"BUSY"}},data:{onlineStatus:online?"ONLINE":"OFFLINE"}});
    if(!changed.count) throw new ApiError(409,"DRIVER_BUSY","Dang co chuyen hoat dong");
    return tx.driverProfile.findUniqueOrThrow({where:{id:driver.id}});
  });
  emitAdmin();return result;
}
export async function updateLocation(userId:string,input:{lat:number;lng:number;heading?:number;speed?:number}) {
  const driver=await getMe(userId);
  const location=await prisma.driverLocation.upsert({where:{driverId:driver.id},create:{driverId:driver.id,...input},update:input});
  const rides=await prisma.ride.findMany({where:{driverId:driver.id,status:{in:activeRideStatuses}},select:{id:true}});
  rides.forEach(r=>emitToRide(r.id,"driver.location.updated",{rideId:r.id,...input,updatedAt:location.updatedAt}));
  return location;
}
export async function listRideRequests(userId:string) {
  const driver=await getMe(userId);
  if(driver.verificationStatus!=="APPROVED" || driver.onlineStatus!=="ONLINE") return [];
  const offers=await prisma.driverOffer.findMany({
    where:{driverId:driver.id,status:"PENDING",expiresAt:{gt:new Date()},ride:{status:"SEARCHING_DRIVER",driverId:null}},
    include:{ride:{include:{vehicleType:true,stops:{orderBy:{orderIndex:"asc"}}}}},
    orderBy:{createdAt:"asc"},
    take:5
  });
  return offers.map(offer=>({...offer.ride,offerExpiresAt:offer.expiresAt,pickupDistanceKm:Number(offer.pickupDistanceKm),matchingRadiusKm:Number(offer.radiusKm)}));
}
export async function acceptRide(userId:string,id:string) {
  const driver=await getMe(userId);
  const result=await prisma.$transaction(async tx=>{
    const ride=await tx.ride.findUnique({where:{id}});
    if(!ride || !driver.vehicles.some(v=>v.vehicleTypeId===ride.vehicleTypeId&&v.isActive&&v.registrationStatus==="APPROVED")) throw new ApiError(409,"RIDE_NOT_AVAILABLE","Chuyen khong phu hop");
    const offer=await tx.driverOffer.updateMany({where:{rideId:id,driverId:driver.id,status:"PENDING",expiresAt:{gt:new Date()}},data:{status:"ACCEPTED",respondedAt:new Date()}});
    if(!offer.count) throw new ApiError(409,"RIDE_OFFER_EXPIRED","Loi moi da het han hoac khong con hieu luc");
    const claim=await tx.ride.updateMany({where:{id,status:"SEARCHING_DRIVER",driverId:null},data:{driverId:driver.id,status:"ACCEPTED",acceptedAt:new Date()}});
    if(!claim.count) throw new ApiError(409,"RIDE_NOT_AVAILABLE","Chuyen da duoc nhan");
    const reserve=await tx.driverProfile.updateMany({where:{id:driver.id,verificationStatus:"APPROVED",onlineStatus:"ONLINE"},data:{onlineStatus:"BUSY"}});
    if(!reserve.count) throw new ApiError(409,"DRIVER_NOT_AVAILABLE","Tai xe khong san sang");
    await tx.rideStatusLog.create({data:{rideId:id,fromStatus:"SEARCHING_DRIVER",toStatus:"ACCEPTED",changedById:userId}});
    await tx.driverOffer.updateMany({where:{rideId:id,status:"PENDING"},data:{status:"CANCELLED",respondedAt:new Date()}});
    return tx.ride.findUniqueOrThrow({where:{id},include:rideInclude});
  });
  await notifyRide(id,"ride.accepted");return result;
}
export async function rejectRide(userId:string,id:string) {
  const driver=await getMe(userId);
  const rejected=await prisma.$transaction(async tx=>{
    const offer=await tx.driverOffer.updateMany({where:{rideId:id,driverId:driver.id,status:"PENDING",expiresAt:{gt:new Date()}},data:{status:"REJECTED",respondedAt:new Date()}});
    if(!offer.count) throw new ApiError(409,"RIDE_OFFER_EXPIRED","Loi moi da het han hoac khong con hieu luc");
    await tx.rideRejection.upsert({where:{rideId_driverId:{rideId:id,driverId:driver.id}},create:{rideId:id,driverId:driver.id},update:{}});
    return true;
  });
  if(rejected) await dispatchRide(id);
  return {rejected:true};
}
async function transition(userId:string,id:string,from:RideStatus[],to:RideStatus,reason?:string) {
  const driver=await getMe(userId);
  const result=await prisma.$transaction(async tx=>{
    const ride=await tx.ride.findUnique({where:{id}});
    if(!ride || ride.driverId!==driver.id) throw new ApiError(409,"RIDE_INVALID_STATUS","Chuyen khong hop le");
    const data:Prisma.RideUpdateManyMutationInput={status:to};
    if(to==="ARRIVED") data.arrivedAt=new Date();
    if(to==="IN_PROGRESS") data.startedAt=new Date();
    if(to==="COMPLETED") {data.completedAt=new Date();data.finalFare=ride.estimatedFare;}
    if(to==="CANCELLED_BY_DRIVER") {data.cancelledAt=new Date();data.cancelReason=reason;}
    const changed=await tx.ride.updateMany({where:{id,driverId:driver.id,status:{in:from}},data});
    if(!changed.count) throw new ApiError(409,"RIDE_INVALID_STATUS","Trang thai chuyen da thay doi");
    if(to==="COMPLETED") {
      const amount=Number(ride.estimatedFare??0);
      await tx.payment.create({data:{rideId:id,customerId:ride.customerId,amount,method:"CASH",status:"PAID",paidAt:new Date()}});
      const wallet=await tx.driverWallet.upsert({where:{driverId:driver.id},create:{driverId:driver.id,balance:amount},update:{balance:{increment:amount}}});
      await tx.walletTransaction.create({data:{walletId:wallet.id,rideId:id,amount,type:"RIDE_EARNING",status:"COMPLETED",description:"Cash ride completed"}});
      await tx.driverProfile.update({where:{id:driver.id},data:{onlineStatus:"ONLINE",totalRides:{increment:1}}});
    }
    if(to==="CANCELLED_BY_DRIVER") {
      await tx.driverProfile.update({where:{id:driver.id},data:{onlineStatus:"ONLINE"}});
      await tx.promotionUsage.deleteMany({where:{rideId:id}});
    }
    await tx.rideStatusLog.create({data:{rideId:id,fromStatus:ride.status,toStatus:to,changedById:userId,note:reason}});
    return tx.ride.findUniqueOrThrow({where:{id},include:rideInclude});
  });
  await notifyRide(id,to==="CANCELLED_BY_DRIVER"?"ride.cancelled":"ride.status.changed");
  return result;
}
export const markArrived=(userId:string,id:string)=>transition(userId,id,["ACCEPTED","DRIVER_ARRIVING"],"ARRIVED");
export const startRide=(userId:string,id:string)=>transition(userId,id,["ARRIVED"],"IN_PROGRESS");
export const completeRide=(userId:string,id:string)=>transition(userId,id,["IN_PROGRESS"],"COMPLETED");
export const cancelRide=(userId:string,id:string,reason:string)=>transition(userId,id,["ACCEPTED","DRIVER_ARRIVING","ARRIVED"],"CANCELLED_BY_DRIVER",reason);
export async function getEarnings(userId:string) {
  const driver=await getMe(userId);
  const wallet=await prisma.driverWallet.findUnique({where:{driverId:driver.id},include:{transactions:{orderBy:{createdAt:"desc"},take:50}}});
  return {wallet,completedRides:driver.totalRides};
}
