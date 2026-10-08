import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { apiRequest } from "../services/api";
import type { Point } from "../types";

type Result = Point & { id:string };

export function AddressAutocomplete({label,value,onChange,bias,required=true}:{label:string;value:Point|null;onChange:(point:Point|null)=>void;bias?:Point|null;required?:boolean}){
  const [query,setQuery]=useState(value?.address??"");
  const [results,setResults]=useState<Result[]>([]);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);
  const request=useRef(0);
  useEffect(()=>{if(value?.address!==query&&value?.address)setQuery(value.address);},[value?.address]);
  useEffect(()=>{
    if(query.trim().length<3||query===value?.address){setResults([]);return;}
    const current=++request.current;
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try{
        const params=new URLSearchParams({q:query.trim()});
        if(bias){params.set("lat",String(bias.lat));params.set("lng",String(bias.lng));}
        const found=await apiRequest<Result[]>("/maps/search?"+params);
        if(current===request.current){setResults(found);setOpen(true);}
      }catch{if(current===request.current)setResults([]);}
      finally{if(current===request.current)setLoading(false);}
    },500);
    return()=>window.clearTimeout(timer);
  },[query,bias?.lat,bias?.lng,value?.address]);
  return <div className="address-autocomplete">
    <label>{label}<span className="address-input-wrap"><Search size={16}/><input value={query} required={required} minLength={3} maxLength={191}
      placeholder="Nhập tên đường, tòa nhà hoặc địa danh"
      onFocus={()=>setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),150)}
      onChange={event=>{setQuery(event.target.value);if(event.target.value!==value?.address)onChange(null);}}/></span></label>
    {open&&(loading||results.length>0)&&<div className="address-suggestions" role="listbox">
      {loading&&<span>Đang tìm địa chỉ...</span>}
      {!loading&&results.map(result=><button type="button" role="option" key={result.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange(result);setQuery(result.address);setOpen(false);setResults([]);}}><MapPin size={16}/><span>{result.address}</span></button>)}
    </div>}
    {value&&<small className="selected-coordinate">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</small>}
    <details className="manual-coordinate-entry"><summary>Nhập tọa độ thủ công</summary>
      <label>Địa chỉ<input aria-label={`${label} - Địa chỉ`} value={query} minLength={3} maxLength={191} onChange={event=>{setQuery(event.target.value);onChange({...value??{lat:0,lng:0,address:""},address:event.target.value});}}/></label>
      <div className="coordinate-fields"><label>Vĩ độ<input aria-label={`${label} - Vĩ độ`} type="number" step="any" min={-90} max={90} value={value?.lat??""} onChange={event=>onChange({...value??{address:query,lat:0,lng:0},lat:Number(event.target.value)})}/></label>
      <label>Kinh độ<input aria-label={`${label} - Kinh độ`} type="number" step="any" min={-180} max={180} value={value?.lng??""} onChange={event=>onChange({...value??{address:query,lat:0,lng:0},lng:Number(event.target.value)})}/></label></div>
    </details>
  </div>;
}
