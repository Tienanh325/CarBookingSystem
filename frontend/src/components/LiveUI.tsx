import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { date, labels, money, type Ride } from "../types";
export function Feedback({error,loading}:{error?:string;loading?:boolean}){
  return <>{loading&&<p className="loading-line" role="status">Đang tải dữ liệu...</p>}{error&&<p className="error-line" role="alert">{error}</p>}</>;
}
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="live-dialog" onCancel={e=>{e.preventDefault();close();}}>
    <div className="modal-heading"><h2>{title}</h2><button type="button" className="icon-button" title="Đóng" aria-label="Đóng" onClick={close}><X size={18}/></button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
export function RideDetails({ride}:{ride:Ride}){
  return <div className="ride-details"><p><strong>{labels[ride.status]??ride.status}</strong></p><p>Mã chuyến: {ride.id}</p>
    <p>Đón: {ride.pickupAddress}</p><p>Đến: {ride.dropoffAddress}</p>
    <p>{date(ride.requestedAt)} · {money(ride.finalFare??ride.estimatedFare)}</p>
    {ride.driver&&<p>Tài xế: {ride.driver.user.fullName} · {ride.driver.vehicles?.[0]?.plateNumber}</p>}
    {ride.payment&&<p>Thanh toán: {labels[ride.payment.status]??ride.payment.status}</p>}
    {ride.rating&&<p>Đánh giá: {ride.rating.score}/5 · {ride.rating.comment}</p>}
    {ride.statusLogs?.map(log=><p key={log.id}>{date(log.createdAt)} · {labels[log.toStatus]??log.toStatus}</p>)}
  </div>;
}
