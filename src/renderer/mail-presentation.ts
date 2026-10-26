export function mailSender(raw:string){
 const value=raw.trim(),match=/^(.*?)\s*<([^<>]+)>\s*$/.exec(value),address=(match?.[2]??(value.includes('@')?value:'')).trim();
 const label=(match?.[1]??(address?address.split('@')[0]:value)).trim().replace(/^"(.*)"$/,'$1');
 return{name:label||address||'Sin remitente',address};
}
export function mailDate(raw:string){
 const date=new Date(raw);if(!Number.isFinite(date.getTime()))return{label:'Sin fecha',full:raw||'Sin fecha',iso:undefined};
 return{label:date.toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),full:date.toLocaleString('es-ES',{dateStyle:'full',timeStyle:'short'}),iso:date.toISOString()};
}
