import { useEffect, useState, type FormEvent } from "react";
import { CarFront, LocateFixed, MapPin, RefreshCw, Star } from "lucide-react";
import { MapCanvas } from "../components/MapCanvas";
import { Feedback, Modal, RideDetails } from "../components/LiveUI";
import { apiRequest, mutate, refreshSession } from "../services/api";
import { useLive, useResource, useRideRoom } from "../services/live";
import { date, labels, money, type Driver, type Estimate, type Point, type Ride, type VehicleType } from "../types";

export function CustomerPortal(){
  const {auth,socket}=useLive();
  const vehicles=useResource<VehicleType[]>("/vehicle-types");
  const current=useResource<Ride|null>("/rides/current?as=customer");
  const history=useResource<Ride[]>("/rides?as=customer");
  const [pickup,setPickup]=useState<Point|null>(null),[dropoff,setDropoff]=useState<Point|null>(null);
  const [target,setTarget]=useState<"pickup"|"dropoff">("pickup");
  const [vehicleId,setVehicleId]=useState(""),[promo,setPromo]=useState("");
  const [estimate,setEstimate]=useState<Estimate|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [tab,setTab]=useState("booking");
  const [detail,setDetail]=useState<Ride|null>(null),[enroll,setEnroll]=useState(false);
  const [driverPosition,setDriverPosition]=useState<{lat:number;lng:number}|null>(null);
  const ride=current.data;
  useRideRoom(ride?.id);
  useEffect(()=>{setEstimate(null);},[pickup,dropoff,vehicleId,promo]);
  useEffect(()=>{
    if(!vehicleId&&vehicles.data?.length)setVehicleId(vehicles.data[0].id);
  },[vehicles.data,vehicleId]);
  useEffect(()=>{
    const loc=ride?.driver?.location;setDriverPosition(loc?{lat:Number(loc.lat),lng:Number(loc.lng)}:null);
    if(!socket||!ride)return;
    const update=(p:{rideId:string;lat:number;lng:number})=>{if(p.rideId===ride.id)setDriverPosition({lat:p.lat,lng:p.lng});};
    socket.on("driver.location.updated",update);return()=>{socket.off("driver.location.updated",update);};
  },[socket,ride]);
  async function run(action:()=>Promise<void>){setBusy(true);setError("");try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function choose(lat:number,lng:number){(target==="pickup"?setPickup:setDropoff)({lat,lng,address:`Vị trí ${lat.toFixed(6)}, ${lng.toFixed(6)}`});}
  const input={pickup,dropoff,vehicleTypeId:vehicleId,...(promo.trim()?{promotionCode:promo.trim()}: {})};
  function locate(){
    navigator.geolocation?.getCurrentPosition(p=>setPickup({address:"Vị trí hiện tại",lat:p.coords.latitude,lng:p.coords.longitude}),()=>setError("Không lấy được vị trí. Chọn trên bản đồ hoặc nhập tọa độ."));
  }
  async function book(e:FormEvent){e.preventDefault();await run(async()=>{
    if(!pickup||!dropoff)throw new Error("Chọn đủ điểm đón và điểm đến.");
    if(!estimate){setEstimate(await mutate<Estimate>("/rides/estimate",input));return;}
    const created=await mutate<Ride>("/rides",{...input,paymentMethod:"CASH"});
    current.setData(created);setEstimate(null);await history.reload();
  });}
  async function cancel(e:FormEvent<HTMLFormElement>){e.preventDefault();const reason=String(new FormData(e.currentTarget).get("reason"));await run(async()=>{await mutate("/rides/"+ride!.id+"/cancel",{reason});await current.reload();await history.reload();});}
  async function rate(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await run(async()=>{await mutate("/rides/"+detail!.id+"/rating",{score:Number(f.get("score")),comment:String(f.get("comment"))});setDetail(await apiRequest<Ride>("/rides/"+detail!.id));await history.reload();});}
  async function enrollDriver(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    await run(async()=>{await mutate<Driver>("/drivers/register",{licenseNumber:f.get("licenseNumber"),identityNumber:f.get("identityNumber"),vehicle:{vehicleTypeId:f.get("vehicleTypeId"),plateNumber:f.get("plateNumber"),model:f.get("model")}});
      await refreshSession();setEnroll(false);});
  }
  const from=ride?{address:ride.pickupAddress,lat:Number(ride.pickupLat),lng:Number(ride.pickupLng)}:pickup;
  const to=ride?{address:ride.dropoffAddress,lat:Number(ride.dropoffLat),lng:Number(ride.dropoffLng)}:dropoff;
  return <div className="portal-layout customer-layout">
    <section className="booking-panel">
      <div className="panel-heading"><span className="eyebrow">{auth?.user.fullName}</span><h1>{ride?"Chuyến đi hiện tại":"Bạn muốn đi đâu?"}</h1></div>
      <div className="live-tabs"><button className={tab==="booking"?"active":""} onClick={()=>setTab("booking")}>Đặt xe</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Lịch sử</button><button onClick={()=>setEnroll(true)}>Đăng ký tài xế</button></div>
      <Feedback error={error||current.error||vehicles.error||history.error} loading={current.loading&&!ride}/>
      {tab==="history"?<section><h2>Lịch sử chuyến</h2>{history.data?.length===0&&<p className="empty-copy">Chưa có chuyến đi.</p>}
        {history.data?.map(r=><button key={r.id} className="history-row" onClick={()=>setDetail(r)}><strong>{r.dropoffAddress}</strong><span>{labels[r.status]} · {money(r.finalFare??r.estimatedFare)}</span><small>{date(r.requestedAt)}</small></button>)}</section>
      :ride?<section>
        <h2>{labels[ride.status]}</h2><RideDetails ride={ride}/>
        {ride.driver&&<div className="driver-summary"><div className="driver-identity"><strong>{ride.driver.user.fullName}</strong><span>{ride.driver.ratingAvg}/5</span>
          <a className="secondary-button" href={"tel:"+ride.driver.user.phone}>Gọi tài xế</a></div></div>}
        {["SEARCHING_DRIVER","ACCEPTED","DRIVER_ARRIVING","ARRIVED"].includes(ride.status)&&<form className="live-form" onSubmit={cancel}><label>Lý do hủy<input name="reason" required minLength={3} maxLength={191}/></label><button className="secondary-button danger-text" disabled={busy}>Hủy chuyến</button></form>}
      </section>:<form onSubmit={book} className="live-form">
        <fieldset><legend>Chọn vị trí trên bản đồ</legend><div className="live-tabs">
          <label><input type="radio" name="mapTarget" checked={target==="pickup"} onChange={()=>setTarget("pickup")}/> Điểm đón</label>
          <label><input type="radio" name="mapTarget" checked={target==="dropoff"} onChange={()=>setTarget("dropoff")}/> Điểm đến</label></div></fieldset>
        <PointFields title="Điểm đón" value={pickup} change={setPickup}/>
        <button type="button" className="text-button" onClick={locate}><LocateFixed size={17}/> Vị trí hiện tại</button>
        <PointFields title="Điểm đến" value={dropoff} change={setDropoff}/>
        <label>Loại xe<select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} required><option value="">Chọn loại xe</option>{vehicles.data?.map(v=><option value={v.id} key={v.id}>{v.name} · {v.capacity} chỗ</option>)}</select></label>
        <label>Mã khuyến mãi<input value={promo} onChange={e=>setPromo(e.target.value.toUpperCase())} maxLength={40}/></label>
        <p>Thanh toán: Tiền mặt</p>
        {estimate&&<div className="booking-total"><div><span>Giá dự kiến · {estimate.distanceKm} km · {estimate.durationMin} phút</span><strong>{money(estimate.finalFare)}</strong><span>Giảm {money(estimate.discount)}</span></div></div>}
        <button className="primary-button booking-submit" disabled={busy||!vehicleId||!!current.error||current.loading}><CarFront size={18}/>{busy?"Đang xử lý...":estimate?"Đặt xe":"Tính giá"}</button>
      </form>}
    </section>
    <section className="map-region"><MapCanvas pickup={from} dropoff={to} driver={driverPosition} onPick={ride?undefined:choose}/></section>
    {detail&&<Modal title="Chi tiết chuyến" close={()=>setDetail(null)}><RideDetails ride={detail}/>
      {detail.status==="COMPLETED"&&!detail.rating&&<form className="live-form" onSubmit={rate}><label>Đánh giá<select name="score">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label><label>Nhận xét<input name="comment" maxLength={191}/></label><Feedback error={error}/><button className="primary-button" disabled={busy}><Star size={17}/> Gửi đánh giá</button></form>}
    </Modal>}
    {enroll&&<Modal title="Đăng ký tài xế" close={()=>setEnroll(false)}><form className="live-form" onSubmit={enrollDriver}>
      <label>Số giấy phép lái xe<input name="licenseNumber" required minLength={4} maxLength={40}/></label><label>Số CCCD<input name="identityNumber" required minLength={6} maxLength={30}/></label>
      <label>Loại xe<select name="vehicleTypeId" required>{vehicles.data?.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label>Biển số<input name="plateNumber" required minLength={5} maxLength={20}/></label><label>Mẫu xe<input name="model" required maxLength={80}/></label>
      <Feedback error={error}/><button className="primary-button" disabled={busy}>Gửi hồ sơ</button></form></Modal>}
  </div>;
}
function PointFields({title,value,change}:{title:string;value:Point|null;change:(p:Point)=>void}){
  const set=(field:keyof Point,v:string)=>change({...value??{address:"",lat:0,lng:0},[field]:field==="address"?v:Number(v)});
  return <fieldset className="point-fields"><legend>{title}</legend><label>Địa chỉ<input aria-label={title+" - Địa chỉ"} value={value?.address??""} onChange={e=>set("address",e.target.value)} required minLength={5} maxLength={191}/></label>
    <div className="coordinate-fields"><label>Vĩ độ<input aria-label={title+" - Vĩ độ"} type="number" step="any" min={-90} max={90} required value={value?.lat??""} onChange={e=>set("lat",e.target.value)}/></label>
    <label>Kinh độ<input aria-label={title+" - Kinh độ"} type="number" step="any" min={-180} max={180} required value={value?.lng??""} onChange={e=>set("lng",e.target.value)}/></label></div></fieldset>;
}
