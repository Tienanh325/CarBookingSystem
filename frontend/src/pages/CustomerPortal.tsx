import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CarFront, Clock3, LocateFixed, Plus, Star, Trash2 } from "lucide-react";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { MapCanvas } from "../components/MapCanvas";
import { Feedback, Modal, RideDetails } from "../components/LiveUI";
import { apiRequest, mutate, refreshSession } from "../services/api";
import { useLive, useResource, useRideRoom } from "../services/live";
import { date, labels, money, type Driver, type Estimate, type Point, type Ride, type RideStop, type VehicleType } from "../types";

type MapTarget = "pickup" | "dropoff" | `stop-${number}`;

function localDateTimeMin() {
  const value = new Date(Date.now() + 10 * 60_000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

export function CustomerPortal(){
  const {auth,socket}=useLive();
  const vehicles=useResource<VehicleType[]>("/vehicle-types");
  const current=useResource<Ride|null>("/rides/current?as=customer");
  const history=useResource<Ride[]>("/rides?as=customer");
  const [pickup,setPickup]=useState<Point|null>(null),[dropoff,setDropoff]=useState<Point|null>(null);
  const [stops,setStops]=useState<(Point|null)[]>([]);
  const [target,setTarget]=useState<MapTarget>("pickup");
  const [vehicleId,setVehicleId]=useState(""),[promo,setPromo]=useState("");
  const [scheduleEnabled,setScheduleEnabled]=useState(false),[scheduledAt,setScheduledAt]=useState("");
  const [estimate,setEstimate]=useState<Estimate|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [tab,setTab]=useState("booking");
  const [detail,setDetail]=useState<Ride|null>(null),[enroll,setEnroll]=useState(false);
  const [driverPosition,setDriverPosition]=useState<{lat:number;lng:number}|null>(null);
  const ride=current.data;
  const selectedStops=stops.filter((stop):stop is Point=>Boolean(stop));
  const minSchedule=useMemo(localDateTimeMin,[]);
  useRideRoom(ride?.id);

  useEffect(()=>{setEstimate(null);},[pickup,dropoff,vehicleId,promo,scheduledAt,scheduleEnabled,JSON.stringify(stops)]);
  useEffect(()=>{if(!vehicleId&&vehicles.data?.length)setVehicleId(vehicles.data[0].id);},[vehicles.data,vehicleId]);
  useEffect(()=>{
    const loc=ride?.driver?.location;setDriverPosition(loc?{lat:Number(loc.lat),lng:Number(loc.lng)}:null);
    if(!socket||!ride)return;
    const update=(payload:{rideId:string;lat:number;lng:number})=>{if(payload.rideId===ride.id)setDriverPosition({lat:payload.lat,lng:payload.lng});};
    socket.on("driver.location.updated",update);return()=>{socket.off("driver.location.updated",update);};
  },[socket,ride]);

  async function run(action:()=>Promise<void>){setBusy(true);setError("");try{await action();}catch(reason){setError((reason as Error).message);}finally{setBusy(false);}}
  async function choose(lat:number,lng:number){
    try{
      const point=await apiRequest<Point>(`/maps/reverse?lat=${lat}&lng=${lng}`);
      if(target==="pickup")setPickup(point);else if(target==="dropoff")setDropoff(point);else{
        const index=Number(target.split("-")[1]);setStops(values=>values.map((value,i)=>i===index?point:value));
      }
    }catch{
      const point={lat,lng,address:`Vị trí ${lat.toFixed(6)}, ${lng.toFixed(6)}`};
      if(target==="pickup")setPickup(point);else if(target==="dropoff")setDropoff(point);else{
        const index=Number(target.split("-")[1]);setStops(values=>values.map((value,i)=>i===index?point:value));
      }
    }
  }
  function locate(){navigator.geolocation?.getCurrentPosition(position=>setPickup({address:"Vị trí hiện tại",lat:position.coords.latitude,lng:position.coords.longitude}),()=>setError("Không lấy được vị trí hiện tại. Hãy tìm địa chỉ hoặc chọn trên bản đồ."));}
  const input={pickup,dropoff,stops:selectedStops.map(stop=>({...stop,dwellMinutes:5})),vehicleTypeId:vehicleId,...(promo.trim()?{promotionCode:promo.trim()}:{}),...(scheduleEnabled&&scheduledAt?{scheduledAt:new Date(scheduledAt).toISOString()}: {})};
  async function book(event:FormEvent){event.preventDefault();await run(async()=>{
    if(!pickup||!dropoff)throw new Error("Hãy chọn địa chỉ từ danh sách gợi ý cho điểm đón và điểm đến.");
    if(stops.some(stop=>!stop))throw new Error("Hãy chọn đầy đủ địa chỉ cho các điểm dừng.");
    if(scheduleEnabled&&!scheduledAt)throw new Error("Hãy chọn thời gian đón dự kiến.");
    if(!estimate){setEstimate(await mutate<Estimate>("/rides/estimate",input));return;}
    const created=await mutate<Ride>("/rides",{...input,paymentMethod:"CASH"});
    current.setData(created);setEstimate(null);await history.reload();
  });}
  async function cancel(event:FormEvent<HTMLFormElement>){event.preventDefault();const reason=String(new FormData(event.currentTarget).get("reason"));await run(async()=>{await mutate("/rides/"+ride!.id+"/cancel",{reason});await current.reload();await history.reload();});}
  async function rate(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);await run(async()=>{await mutate("/rides/"+detail!.id+"/rating",{score:Number(form.get("score")),comment:String(form.get("comment"))});setDetail(await apiRequest<Ride>("/rides/"+detail!.id));await history.reload();});}
  async function enrollDriver(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);await run(async()=>{await mutate<Driver>("/drivers/register",{licenseNumber:form.get("licenseNumber"),identityNumber:form.get("identityNumber"),vehicle:{vehicleTypeId:form.get("vehicleTypeId"),plateNumber:form.get("plateNumber"),model:form.get("model")}});await refreshSession();setEnroll(false);});}

  const from=ride?{address:ride.pickupAddress,lat:Number(ride.pickupLat),lng:Number(ride.pickupLng)}:pickup;
  const to=ride?{address:ride.dropoffAddress,lat:Number(ride.dropoffLat),lng:Number(ride.dropoffLng)}:dropoff;
  const mapStops:RideStop[]=ride?.stops??selectedStops;
  const route=ride?.routeGeometry??estimate?.routeGeometry;
  const routeProvider=ride?.routeProvider??estimate?.routeProvider;
  return <div className="portal-layout customer-layout">
    <section className="booking-panel">
      <div className="panel-heading"><span className="eyebrow">{auth?.user.fullName}</span><h1>{ride?"Chuyến đi hiện tại":"Bạn muốn đi đâu?"}</h1></div>
      <div className="live-tabs"><button className={tab==="booking"?"active":""} onClick={()=>setTab("booking")}>Đặt xe</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Lịch sử</button><button onClick={()=>setEnroll(true)}>Đăng ký tài xế</button></div>
      <Feedback error={error||current.error||vehicles.error||history.error} loading={current.loading&&!ride}/>
      {tab==="history"?<section><h2>Lịch sử chuyến</h2>{history.data?.length===0&&<p className="empty-copy">Chưa có chuyến đi.</p>}{history.data?.map(item=><button key={item.id} className="history-row" onClick={()=>setDetail(item)}><strong>{item.dropoffAddress}</strong><span>{labels[item.status]} · {money(item.finalFare??item.estimatedFare)}</span><small>{date(item.scheduledAt??item.requestedAt)}</small></button>)}</section>
      :ride?<section><h2>{labels[ride.status]}</h2><RideDetails ride={ride}/>{ride.driver&&<div className="driver-summary"><div className="driver-identity"><strong>{ride.driver.user.fullName}</strong><span>{ride.driver.ratingAvg}/5</span><a className="secondary-button" href={"tel:"+ride.driver.user.phone}>Gọi tài xế</a></div></div>}
        {["SCHEDULED","SEARCHING_DRIVER","ACCEPTED","DRIVER_ARRIVING","ARRIVED"].includes(ride.status)&&<form className="live-form" onSubmit={cancel}><label>Lý do hủy<input name="reason" required minLength={3} maxLength={191}/></label><button className="secondary-button danger-text" disabled={busy}>Hủy chuyến</button></form>}</section>
      :<form onSubmit={book} className="live-form booking-form">
        <fieldset><legend>Chọn nhanh trên bản đồ</legend><div className="live-tabs"><label><input type="radio" name="mapTarget" checked={target==="pickup"} onChange={()=>setTarget("pickup")}/> Điểm đón</label><label><input type="radio" name="mapTarget" checked={target==="dropoff"} onChange={()=>setTarget("dropoff")}/> Điểm đến</label>{stops.map((_,index)=><label key={index}><input type="radio" name="mapTarget" checked={target===`stop-${index}`} onChange={()=>setTarget(`stop-${index}`)}/> Dừng {index+1}</label>)}</div></fieldset>
        <AddressAutocomplete label="Điểm đón" value={pickup} onChange={setPickup}/><button type="button" className="text-button" onClick={locate}><LocateFixed size={17}/> Dùng vị trí hiện tại</button>
        {stops.map((stop,index)=><div className="stop-row" key={index}><AddressAutocomplete label={`Điểm dừng ${index+1}`} value={stop} bias={pickup} onChange={point=>setStops(values=>values.map((value,i)=>i===index?point:value))}/><button type="button" className="icon-button danger-text" aria-label={`Xóa điểm dừng ${index+1}`} onClick={()=>{setStops(values=>values.filter((_,i)=>i!==index));setTarget("pickup");}}><Trash2 size={17}/></button></div>)}
        {stops.length<2&&<button type="button" className="secondary-button add-stop" onClick={()=>{setStops(values=>[...values,null]);setTarget(`stop-${stops.length}`);}}><Plus size={17}/> Thêm điểm dừng</button>}
        <AddressAutocomplete label="Điểm đến" value={dropoff} bias={pickup} onChange={setDropoff}/>
        <label className="check-label"><input type="checkbox" checked={scheduleEnabled} onChange={event=>{setScheduleEnabled(event.target.checked);if(!event.target.checked)setScheduledAt("");}}/><Clock3 size={17}/> Đặt xe theo lịch hẹn</label>
        {scheduleEnabled&&<label>Thời gian đón<input type="datetime-local" min={minSchedule} value={scheduledAt} onChange={event=>setScheduledAt(event.target.value)} required/></label>}
        <label>Loại xe<select value={vehicleId} onChange={event=>setVehicleId(event.target.value)} required><option value="">Chọn loại xe</option>{vehicles.data?.map(vehicle=><option value={vehicle.id} key={vehicle.id}>{vehicle.name} · {vehicle.capacity} chỗ</option>)}</select></label>
        <label>Mã khuyến mãi<input value={promo} onChange={event=>setPromo(event.target.value.toUpperCase())} maxLength={40}/></label><p>Thanh toán: Tiền mặt</p>
        {estimate&&<div className="booking-total"><div><span>Giá dự kiến · {estimate.distanceKm} km · {estimate.durationMin} phút · {estimate.routeProvider.toUpperCase()}</span><strong>{money(estimate.finalFare)}</strong><span>Phí dừng {money(estimate.stopFee)} · Giảm {money(estimate.discount)}{estimate.trafficAware?" · ETA theo giao thông":""}</span></div></div>}
        <button className="primary-button booking-submit" disabled={busy||!vehicleId||!!current.error||current.loading}><CarFront size={18}/>{busy?"Đang xử lý...":estimate?(scheduleEnabled?"Xác nhận lịch hẹn":"Đặt xe"):"Tính giá & lộ trình"}</button>
      </form>}
    </section>
    <section className="map-region"><MapCanvas pickup={from} dropoff={to} stops={mapStops} route={route} routeProvider={routeProvider} trafficAware={estimate?.trafficAware} driver={driverPosition} onPick={ride?undefined:(lat,lng)=>void choose(lat,lng)}/></section>
    {detail&&<Modal title="Chi tiết chuyến" close={()=>setDetail(null)}><RideDetails ride={detail}/>{detail.status==="COMPLETED"&&!detail.rating&&<form className="live-form" onSubmit={rate}><label>Đánh giá<select name="score">{[5,4,3,2,1].map(number=><option key={number}>{number}</option>)}</select></label><label>Nhận xét<input name="comment" maxLength={191}/></label><Feedback error={error}/><button className="primary-button" disabled={busy}><Star size={17}/> Gửi đánh giá</button></form>}</Modal>}
    {enroll&&<Modal title="Đăng ký tài xế" close={()=>setEnroll(false)}><form className="live-form" onSubmit={enrollDriver}><label>Số giấy phép lái xe<input name="licenseNumber" required minLength={4} maxLength={40}/></label><label>Số CCCD<input name="identityNumber" required minLength={6} maxLength={30}/></label><label>Loại xe<select name="vehicleTypeId" required>{vehicles.data?.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label><label>Biển số<input name="plateNumber" required minLength={5} maxLength={20}/></label><label>Mẫu xe<input name="model" required maxLength={80}/></label><Feedback error={error}/><button className="primary-button" disabled={busy}>Gửi hồ sơ</button></form></Modal>}
  </div>;
}
