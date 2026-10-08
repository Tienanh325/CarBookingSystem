import { useEffect, useState, type FormEvent } from "react";
import { LocateFixed, Navigation, CheckCircle2, X, RefreshCw } from "lucide-react";
import { MapCanvas } from "../components/MapCanvas";
import { Feedback, Modal, RideDetails } from "../components/LiveUI";
import { mutate } from "../services/api";
import { useResource, useRideRoom } from "../services/live";
import { date, labels, money, type Driver, type Ride } from "../types";
export function DriverPortal(){
  const profile=useResource<Driver>("/drivers/me");
  const current=useResource<Ride|null>("/rides/current?as=driver");
  const requests=useResource<Ride[]>("/drivers/me/ride-requests");
  const earnings=useResource<{wallet:{balance:string;transactions:{id:string;amount:string;createdAt:string}[]}|null;completedRides:number}>("/drivers/me/earnings");
  const history=useResource<Ride[]>("/rides?as=driver");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[tracking,setTracking]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [detail,setDetail]=useState<Ride|null>(null);
  const ride=current.data,driver=profile.data;
  useRideRoom(ride?.id);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  async function run(action:()=>Promise<unknown>){setBusy(true);setError("");try{await action();await Promise.all([profile.reload(),current.reload(),requests.reload(),earnings.reload(),history.reload()]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{
    if(!tracking||!navigator.geolocation)return;
    let last=0;
    const watch=navigator.geolocation.watchPosition(position=>{
      if(Date.now()-last<5000)return;last=Date.now();
      void mutate("/drivers/me/location",{lat:position.coords.latitude,lng:position.coords.longitude,...(position.coords.heading!=null?{heading:position.coords.heading}:{}),...(position.coords.speed!=null?{speed:position.coords.speed}:{})}).catch(e=>setError(e.message));
    },()=>{setTracking(false);setError("Chưa có quyền GPS. Vui lòng cho phép vị trí trong trình duyệt.");},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
    return()=>navigator.geolocation.clearWatch(watch);
  },[tracking]);
  async function cancel(e:FormEvent<HTMLFormElement>){e.preventDefault();const reason=String(new FormData(e.currentTarget).get("reason"));await run(()=>mutate("/drivers/rides/"+ride!.id+"/cancel",{reason}));}
  const action=ride?.status==="ACCEPTED"||ride?.status==="DRIVER_ARRIVING"?["arrived","Đã đến điểm đón"]:ride?.status==="ARRIVED"?["start","Bắt đầu chuyến"]:["complete","Hoàn thành chuyến"];
  return <div className="portal-layout driver-layout">
    <section className="map-region"><MapCanvas pickup={ride?{address:ride.pickupAddress,lat:Number(ride.pickupLat),lng:Number(ride.pickupLng)}:null} dropoff={ride?{address:ride.dropoffAddress,lat:Number(ride.dropoffLat),lng:Number(ride.dropoffLng)}:null} stops={ride?.stops} route={ride?.routeGeometry} routeProvider={ride?.routeProvider} driver={driver?.location?{lat:Number(driver.location.lat),lng:Number(driver.location.lng)}:null}/></section>
    <aside className="driver-panel"><div className="panel-heading"><span className="eyebrow">{driver?.user.fullName}</span><h1>Không gian tài xế</h1></div>
      <Feedback error={error||profile.error||current.error||requests.error||earnings.error} loading={profile.loading&&!driver}/>
      {driver&&<><p>Hồ sơ: <strong>{labels[driver.verificationStatus]??driver.verificationStatus}</strong></p><p>Trạng thái: {labels[driver.onlineStatus]}</p>
        {!driver.location&&<p className="empty-copy">Bật chia sẻ GPS trước khi Online để hệ thống xếp tài xế theo khoảng cách.</p>}
        <div className="live-actions"><button className="primary-button" disabled={busy||!!ride||driver.verificationStatus!=="APPROVED"||(driver.onlineStatus==="OFFLINE"&&!driver.location)} onClick={()=>void run(()=>mutate("/drivers/me/"+(driver.onlineStatus==="OFFLINE"?"online":"offline")))}><Navigation size={18}/>{driver.onlineStatus==="OFFLINE"?"Bật Online":"Tắt Online"}</button>
        <button className="secondary-button" aria-pressed={tracking} onClick={()=>setTracking(!tracking)}><LocateFixed size={18}/>{tracking?"Dừng GPS":"Chia sẻ GPS"}</button></div></>}
      <div className="driver-stats"><div><span>Thu nhập tích lũy</span><strong>{money(earnings.data?.wallet?.balance)}</strong></div><div><span>Hoàn thành</span><strong>{earnings.data?.completedRides??0}</strong></div></div>
      {ride?<section><h2>{labels[ride.status]}</h2><RideDetails ride={ride}/><a className="secondary-button" href={"tel:"+ride.customer.phone}>Gọi khách hàng</a>
        <button className="primary-button full-width" disabled={busy} onClick={()=>void run(()=>mutate("/drivers/rides/"+ride.id+"/"+action[0]))}><CheckCircle2 size={18}/>{action[1]}</button>
        {ride.status!=="IN_PROGRESS"&&<form className="live-form" onSubmit={cancel}><label>Lý do hủy<input name="reason" required minLength={3} maxLength={191}/></label><button className="secondary-button danger-text" disabled={busy}>Hủy chuyến</button></form>}
      </section>:<section><h2>Yêu cầu chuyến mới</h2>{requests.data?.length===0&&<p className="empty-copy">{driver?.onlineStatus==="ONLINE"?"Chưa có chuyến phù hợp.":"Bật Online sau khi hồ sơ được duyệt để nhận chuyến."}</p>}
        {requests.data?.map(r=>{const seconds=Math.max(0,Math.ceil((new Date(r.offerExpiresAt??0).getTime()-now)/1000));return <article key={r.id} className="incoming-request request-item"><div className="offer-countdown"><span>Lời mời riêng · bán kính {r.matchingRadiusKm} km</span><strong>{seconds}s</strong></div><p><strong>{r.pickupAddress}</strong></p>{r.stops?.map((stop,index)=><p key={stop.id??index}>Dừng {index+1}: {stop.address}</p>)}<p>{r.dropoffAddress}</p><p>{money(r.estimatedFare)} · {r.estimatedDistanceKm} km · cách điểm đón {r.pickupDistanceKm} km</p><div className="dual-actions"><button className="secondary-button" disabled={busy||seconds===0} onClick={()=>void run(()=>mutate("/drivers/rides/"+r.id+"/reject"))}><X size={17}/>Từ chối</button><button className="primary-button" disabled={busy||seconds===0} onClick={()=>void run(()=>mutate("/drivers/rides/"+r.id+"/accept"))}>Nhận chuyến</button></div></article>;})}</section>}
      <section className="driver-history"><h2>Chuyến đã thực hiện</h2>{history.data?.map(r=><button key={r.id} className="history-row" onClick={()=>setDetail(r)}><strong>{r.dropoffAddress}</strong><span>{labels[r.status]} · {money(r.finalFare??r.estimatedFare)}</span></button>)}</section>
      {detail&&<Modal title="Chi tiết chuyến" close={()=>setDetail(null)}><RideDetails ride={detail}/></Modal>}
    </aside>
  </div>;
}
