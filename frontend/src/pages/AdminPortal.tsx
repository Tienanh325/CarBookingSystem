import { useState, type FormEvent, type ReactNode } from "react";
import { CarFront, Check, ChevronLeft, ChevronRight, Eye, LayoutDashboard, Pencil, Plus, RefreshCw, Route, Search, Tags, UsersRound, Wallet, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Feedback, Modal, RideDetails } from "../components/LiveUI";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest, mutate } from "../services/api";
import { useResource } from "../services/live";
import { date, labels, money, type Driver, type Page, type Pricing, type Promotion, type Ride, type User, type VehicleType } from "../types";

type Section="overview"|"rides"|"drivers"|"pricing"|"promotions"|"users"|"payments";
const menus=[{id:"overview",name:"Tổng quan",icon:LayoutDashboard},{id:"rides",name:"Chuyến đi",icon:Route},{id:"drivers",name:"Tài xế",icon:CarFront},{id:"pricing",name:"Bảng giá",icon:Wallet},{id:"promotions",name:"Khuyến mãi",icon:Tags},{id:"users",name:"Tài khoản",icon:UsersRound},{id:"payments",name:"Thanh toán",icon:Wallet}] as const;
function Badge({status}:{status:string}){return <StatusBadge tone={["COMPLETED","APPROVED","PAID","ACTIVE"].includes(status)?"success":status.includes("CANCEL")||["REJECTED","LOCKED"].includes(status)?"danger":"info"}>{labels[status]??status}</StatusBadge>;}
function IconAction({label,onClick,children}:{label:string;onClick:()=>void;children:ReactNode}){return <button className="icon-button subtle" aria-label={label} title={label} onClick={onClick}>{children}</button>;}
function Pager({page,total,change}:{page:number;total:number;change:(page:number)=>void}){
  const pages=Math.max(1,Math.ceil(total/10));
  return <div className="table-pagination"><span>{total} bản ghi · Trang {page}/{pages}</span><div><button className="icon-button" title="Trang trước" aria-label="Trang trước" disabled={page<=1} onClick={()=>change(page-1)}><ChevronLeft size={18}/></button><button className="icon-button" title="Trang sau" aria-label="Trang sau" disabled={page>=pages} onClick={()=>change(page+1)}><ChevronRight size={18}/></button></div></div>;
}
export function AdminPortal(){
  const [section,setSection]=useState<Section>("overview");
  return <div className="admin-layout"><aside className="admin-sidebar"><div className="admin-sidebar-label">Vận hành</div><nav aria-label="Điều hướng quản trị">{menus.map(m=><button key={m.id} className={m.id===section?"active":""} onClick={()=>setSection(m.id)}><m.icon size={18}/><span>{m.name}</span></button>)}</nav></aside>
    <main className="admin-main"><header className="admin-content-header"><h1>{menus.find(m=>m.id===section)?.name}</h1><span>{new Date().toLocaleDateString("vi-VN")}</span></header><div className="admin-content">
      {section==="overview"?<Overview openRides={()=>setSection("rides")}/>:section==="pricing"?<PricingView/>:section==="promotions"?<PromotionsView/>:<RecordsView key={section} section={section}/>}
    </div></main></div>;
}
function Overview({openRides}:{openRides:()=>void}){
  const resource=useResource<{revenue:number;completedRides:number;activeRides:number;onlineDrivers:number;dailyRevenue:{day:string;revenue:number}[];statusCounts:{status:string;count:number}[]}>("/admin/dashboard");
  const d=resource.data;
  return <><Feedback error={resource.error} loading={resource.loading&&!d}/><button className="text-button" onClick={()=>void resource.reload()}><RefreshCw size={16}/>Làm mới</button>
    {d&&<><section className="metric-grid">{[["Doanh thu đã thu",money(d.revenue)],["Chuyến hoàn thành",d.completedRides],["Chuyến hoạt động",d.activeRides],["Tài xế online",d.onlineDrivers]].map(([k,v])=><article className="metric-card" key={String(k)}><span>{k}</span><strong>{v}</strong></article>)}</section>
      <section className="admin-dashboard-grid"><div className="data-panel"><div className="data-panel-heading"><h2>Doanh thu 7 ngày (UTC)</h2></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.dailyRevenue}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day" tickFormatter={s=>s.slice(5)}/><YAxis width={65}/><Tooltip formatter={value=>money(Number(value))}/><Line dataKey="revenue" stroke="#087a55" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
      <div className="data-panel"><div className="data-panel-heading"><h2>Trạng thái chuyến</h2></div><div className="operation-stat-list">{d.statusCounts.map(s=><div key={s.status}><span className="operation-dot riding"/><div><span>{labels[s.status]??s.status}</span><strong>{s.count}</strong></div></div>)}{!d.statusCounts.length&&<p className="empty-copy">Chưa có chuyến đi.</p>}</div><button className="text-button" onClick={openRides}>Xem chuyến đi <ChevronRight size={17}/></button></div></section></>}
  </>;
}
type Payment={id:string;amount:string;status:string;method:string;createdAt:string;customer:User;ride:Ride};
function RecordsView({section}:{section:"rides"|"drivers"|"users"|"payments"}){
  const [search,setSearch]=useState(""),[query,setQuery]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState<Ride|Driver|(User&{status:string})|null>(null);
  const resource=useResource<Page<Ride|Driver|(User&{status:string})|Payment>>("/admin/"+section+"?"+new URLSearchParams({search:query,status,page:String(page),limit:"10"}));
  const options=section==="rides"?["SEARCHING_DRIVER","ACCEPTED","ARRIVED","IN_PROGRESS","COMPLETED","CANCELLED_BY_CUSTOMER","CANCELLED_BY_DRIVER","CANCELLED_BY_SYSTEM"]:section==="drivers"?["PENDING","APPROVED","REJECTED"]:section==="users"?["ACTIVE","LOCKED"]:["PENDING","PAID","FAILED","REFUNDED"];
  async function show(id:string){
    setError("");try {setSelected(await apiRequest<Ride|Driver>("/admin/"+section+"/"+id));}catch(e){setError((e as Error).message);}
  }
  async function action(path:string,body:unknown={},method="POST"){
    setBusy(true);setError("");try{await mutate(path,body,method);setSelected(null);await resource.reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const ride=section==="rides"?selected as Ride|null:null, driver=section==="drivers"?selected as Driver|null:null;
  return <section className="records-section"><div className="filter-bar">
    {section!=="payments"&&<form className="search-control" onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search);}}><input aria-label="Tìm kiếm" placeholder="Mã, tên hoặc số điện thoại" value={search} onChange={e=>setSearch(e.target.value)}/><button className="icon-button subtle" title="Tìm kiếm" aria-label="Tìm kiếm"><Search size={18}/></button></form>}
    <select className="select-control" aria-label="Trạng thái" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Tất cả trạng thái</option>{options.map(s=><option key={s} value={s}>{labels[s]??s}</option>)}</select>
    <IconAction label="Làm mới" onClick={()=>void resource.reload()}><RefreshCw size={18}/></IconAction></div>
    <Feedback error={error||resource.error} loading={resource.loading}/>
    <div className="table-scroll"><table className="data-table live-records"><thead><tr><th>{section==="rides"?"Chuyến đi":section==="drivers"?"Tài xế":section==="users"?"Tài khoản":"Thanh toán"}</th><th>Thông tin</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
    {resource.data?.items.map(item=>{
      if(section==="rides"){const r=item as Ride;return <tr key={r.id}><td><strong>{r.customer.fullName}</strong><small className="record-id">{r.id}</small></td><td><div className="stacked-cell"><span>{r.pickupAddress}</span><strong>{r.dropoffAddress}</strong><span>{money(r.finalFare??r.estimatedFare)}</span></div></td><td><Badge status={r.status}/></td><td><IconAction label="Xem chuyến" onClick={()=>void show(r.id)}><Eye size={18}/></IconAction></td></tr>;}
      if(section==="drivers"){const d=item as Driver;return <tr key={d.id}><td><strong>{d.user.fullName}</strong><small className="record-id">{d.user.phone}</small></td><td><div className="stacked-cell"><strong>{d.vehicles.map(v=>v.plateNumber).join(", ")}</strong><span>{d.totalRides} chuyến · {labels[d.onlineStatus]}</span></div></td><td><Badge status={d.verificationStatus}/></td><td><IconAction label="Xem hồ sơ" onClick={()=>void show(d.id)}><Eye size={18}/></IconAction></td></tr>;}
      if(section==="users"){const u=item as User&{status:string};return <tr key={u.id}><td>{u.fullName}</td><td>{u.phone}</td><td><Badge status={u.status}/></td><td><IconAction label="Sửa trạng thái" onClick={()=>setSelected(u)}><Pencil size={18}/></IconAction></td></tr>;}
      const p=item as Payment;return <tr key={p.id}><td>{p.customer.fullName}<small className="record-id">{p.id}</small></td><td>{money(p.amount)} · {p.method}<small className="record-id">{date(p.createdAt)}</small></td><td><Badge status={p.status}/></td><td>{p.ride.id.slice(0,8)}</td></tr>;
    })}</tbody></table></div>
    {resource.data?.items.length===0&&<p className="empty-copy">Không có dữ liệu phù hợp.</p>}
    <Pager page={page} total={resource.data?.total??0} change={setPage}/>
    {selected&&<Modal title={ride?"Chi tiết chuyến":driver?"Hồ sơ tài xế":"Trạng thái tài khoản"} close={()=>setSelected(null)}>
      <Feedback error={error}/>
      {ride&&<><RideDetails ride={ride}/>{["SEARCHING_DRIVER","ACCEPTED","DRIVER_ARRIVING","ARRIVED"].includes(ride.status)&&<form className="live-form" onSubmit={e=>{e.preventDefault();void action("/admin/rides/"+ride.id+"/cancel",{reason:new FormData(e.currentTarget).get("reason")});}}><label>Lý do hủy<input name="reason" required minLength={3} maxLength={191}/></label><button className="secondary-button danger-text" disabled={busy}>Xác nhận hủy chuyến</button></form>}</>}
      {driver&&<><p><strong>{driver.user.fullName}</strong> · {driver.user.phone}</p><p>{driver.vehicles.map(v=>v.plateNumber+" · "+(v.model??v.vehicleType.name)).join(", ")}</p><Badge status={driver.verificationStatus}/><div className="live-actions">
        {driver.verificationStatus!=="APPROVED"&&<button className="primary-button" disabled={busy} onClick={()=>void action("/admin/drivers/"+driver.id+"/approve")}><Check size={18}/>Duyệt hồ sơ</button>}</div>
        <form className="live-form" onSubmit={e=>{e.preventDefault();void action("/admin/drivers/"+driver.id+"/reject",{reason:new FormData(e.currentTarget).get("reason")});}}><label>Lý do từ chối<input name="reason" required minLength={3} maxLength={191}/></label><button className="secondary-button danger-text" disabled={busy||driver.onlineStatus==="BUSY"}>Từ chối hồ sơ</button></form></>}
      {section==="users"&&<form className="live-form" onSubmit={e=>{e.preventDefault();void action("/admin/users/"+selected.id+"/status",{status:new FormData(e.currentTarget).get("status")},"PATCH");}}><p>{(selected as User).fullName}</p><label>Trạng thái<select name="status" defaultValue={(selected as User&{status:string}).status}><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Khóa tài khoản</option></select></label><button className="primary-button" disabled={busy}>Lưu thay đổi</button></form>}
    </Modal>}
  </section>;
}
function PricingView(){
  const resource=useResource<Pricing[]>("/admin/pricing-rules"), vehicles=useResource<VehicleType[]>("/vehicle-types");
  const [editing,setEditing]=useState<Pricing|"new"|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const item=editing&&editing!=="new"?editing:null;
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);
    try{await mutate(item?"/admin/pricing-rules/"+item.id:"/admin/pricing-rules",{vehicleTypeId:f.get("vehicleTypeId"),baseFare:Number(f.get("baseFare")),perKmFare:Number(f.get("perKmFare")),perMinuteFare:Number(f.get("perMinuteFare")),minimumFare:Number(f.get("minimumFare")),peakMultiplier:Number(f.get("peakMultiplier")),isActive:f.get("isActive")==="on"},item?"PATCH":"POST");setEditing(null);await resource.reload();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section><div className="data-panel-heading"><h2>Bảng giá</h2><button className="primary-button" onClick={()=>setEditing("new")}><Plus size={18}/>Thêm quy tắc</button></div><Feedback error={resource.error||vehicles.error} loading={resource.loading}/>
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Loại xe</th><th>Mở cửa</th><th>Mỗi km</th><th>Mỗi phút</th><th>Tối thiểu</th><th>Hệ số</th><th>Áp dụng</th><th>Sửa</th></tr></thead><tbody>{resource.data?.map(p=><tr key={p.id}><td>{p.vehicleType.name}</td><td>{money(p.baseFare)}</td><td>{money(p.perKmFare)}</td><td>{money(p.perMinuteFare)}</td><td>{money(p.minimumFare)}</td><td>{p.peakMultiplier}</td><td>{p.isActive?"Có":"Không"}</td><td><IconAction label={"Sửa "+p.vehicleType.name} onClick={()=>setEditing(p)}><Pencil size={18}/></IconAction></td></tr>)}</tbody></table></div>
    {editing&&<Modal title={item?"Sửa bảng giá":"Thêm bảng giá"} close={()=>setEditing(null)}><form className="live-form" onSubmit={save}><label>Loại xe<select name="vehicleTypeId" defaultValue={item?.vehicleTypeId} required>{vehicles.data?.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      {([["baseFare","Giá mở cửa"],["perKmFare","Giá mỗi km"],["perMinuteFare","Giá mỗi phút"],["minimumFare","Giá tối thiểu"],["peakMultiplier","Hệ số cao điểm"]] as const).map(([key,label])=><label key={key}>{label}<input name={key} type="number" step={key==="peakMultiplier"?".01":"1"} min={key==="peakMultiplier"?1:0} required defaultValue={item?.[key]??(key==="peakMultiplier"?1:0)}/></label>)}
      <label className="check-label"><input name="isActive" type="checkbox" defaultChecked={item?.isActive??true}/> Đang áp dụng</label><Feedback error={error}/><button className="primary-button" disabled={busy}>Lưu bảng giá</button></form></Modal>}
  </section>;
}
function PromotionsView(){
  const resource=useResource<Promotion[]>("/admin/promotions");
  const [editing,setEditing]=useState<Promotion|"new"|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const item=editing&&editing!=="new"?editing:null;
  const localDate=(value:string)=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setError("");setBusy(true);
    try{const start=new Date(String(f.get("startsAt"))),end=new Date(String(f.get("endsAt")));if(end<=start)throw new Error("Ngày hết hạn phải sau ngày bắt đầu.");
      await mutate(item?"/admin/promotions/"+item.id:"/admin/promotions",{code:f.get("code"),name:f.get("name"),type:f.get("type"),value:Number(f.get("value")),usageLimit:Number(f.get("usageLimit")),maxDiscount:f.get("maxDiscount")?Number(f.get("maxDiscount")):null,minRideFare:Number(f.get("minRideFare")),startsAt:start.toISOString(),endsAt:end.toISOString(),isActive:f.get("isActive")==="on"},item?"PATCH":"POST");setEditing(null);await resource.reload();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section><div className="data-panel-heading"><h2>Chương trình khuyến mãi</h2><button className="primary-button" onClick={()=>setEditing("new")}><Plus size={18}/>Tạo khuyến mãi</button></div><Feedback error={resource.error} loading={resource.loading}/>
    <div className="promotion-grid">{resource.data?.map(p=><article key={p.id} className="promotion-card"><h3>{p.name}</h3><strong>{p.type==="PERCENTAGE"?p.value+"%":money(p.value)}</strong><p><code>{p.code}</code></p><p>{date(p.endsAt)}</p><p>{p.isActive?"Đang bật":"Đang tắt"}</p><IconAction label={"Sửa "+p.code} onClick={()=>setEditing(p)}><Pencil size={18}/></IconAction></article>)}</div>{resource.data?.length===0&&<p className="empty-copy">Chưa có khuyến mãi.</p>}
    {editing&&<Modal title={item?"Sửa khuyến mãi":"Tạo khuyến mãi"} close={()=>setEditing(null)}><form className="live-form" onSubmit={save}>
      <label>Mã khuyến mãi<input name="code" required minLength={2} maxLength={40} defaultValue={item?.code}/></label><label>Tên chương trình<input name="name" required minLength={2} maxLength={120} defaultValue={item?.name}/></label>
      <label>Loại giảm giá<select name="type" defaultValue={item?.type??"PERCENTAGE"}><option value="PERCENTAGE">Phần trăm</option><option value="FIXED_AMOUNT">Số tiền</option></select></label>
      <label>Giá trị<input name="value" required type="number" min={0} defaultValue={item?.value??10}/></label>
      <label>Giảm tối đa (đ)<input name="maxDiscount" type="number" min={0} defaultValue={item?.maxDiscount??""}/></label><label>Giá chuyến tối thiểu (đ)<input name="minRideFare" required type="number" min={0} defaultValue={item?.minRideFare??0}/></label>
      <label>Giới hạn lượt dùng<input name="usageLimit" required type="number" min={1} defaultValue={item?.usageLimit??100}/></label>
      <label>Bắt đầu<input name="startsAt" type="datetime-local" required defaultValue={localDate(item?.startsAt??new Date().toISOString())}/></label>
      <label>Kết thúc<input name="endsAt" type="datetime-local" required defaultValue={item?localDate(item.endsAt):""}/></label>
      <label className="check-label"><input name="isActive" type="checkbox" defaultChecked={item?.isActive??true}/> Kích hoạt</label>
      <Feedback error={error}/><button className="primary-button" disabled={busy}>Lưu khuyến mãi</button></form></Modal>}
  </section>;
}
