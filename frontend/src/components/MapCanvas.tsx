import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import type { Point } from "../types";
type Props={pickup?:Point|null;dropoff?:Point|null;driver?:{lat:number;lng:number}|null;onPick?:(lat:number,lng:number)=>void};
function MapEvents({pickup,dropoff,onPick}:Props){
  const map=useMap();
  useMapEvents({click:e=>onPick?.(e.latlng.lat,e.latlng.lng)});
  useEffect(()=>{
    const points=[pickup,dropoff].filter(Boolean).map(p=>[p!.lat,p!.lng] as [number,number]);
    if(points.length>1)map.fitBounds(points,{padding:[50,50],maxZoom:15});
    else if(points[0])map.setView(points[0],15);
    const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(map.getContainer());
    return()=>observer.disconnect();
  },[map,pickup?.lat,pickup?.lng,dropoff?.lat,dropoff?.lng]);
  return null;
}
export function MapCanvas(props:Props){
  const [failed,setFailed]=useState(false);
  return <div className="map-canvas live-map" aria-label="Bản đồ điểm đón và điểm đến">
    <MapContainer center={[10.7769,106.7009]} zoom={13} zoomControl={false}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        eventHandlers={{tileerror:()=>setFailed(true)}}/>
      <ZoomControl position="bottomright"/><MapEvents {...props}/>
      {props.pickup&&<CircleMarker center={[props.pickup.lat,props.pickup.lng]} pathOptions={{color:"#087a55"}}><Tooltip permanent>Điểm đón</Tooltip></CircleMarker>}
      {props.dropoff&&<CircleMarker center={[props.dropoff.lat,props.dropoff.lng]} pathOptions={{color:"#17211d"}}><Tooltip permanent>Điểm đến</Tooltip></CircleMarker>}
      {props.pickup&&props.dropoff&&<Polyline positions={[[props.pickup.lat,props.pickup.lng],[props.dropoff.lat,props.dropoff.lng]]} pathOptions={{color:"#087a55",dashArray:"7 8",weight:3}}/>}
      {props.driver&&<CircleMarker center={[props.driver.lat,props.driver.lng]} pathOptions={{color:"#087f8c"}}><Tooltip permanent>Tài xế</Tooltip></CircleMarker>}
    </MapContainer>
    {failed&&<div className="map-warning" role="status">Không tải được bản đồ nền. Tọa độ chuyến vẫn được lưu.</div>}
    {props.pickup&&props.dropoff&&<div className="map-caption">Khoảng cách ước tính, chưa có chỉ đường giao thông.</div>}
  </div>;
}
