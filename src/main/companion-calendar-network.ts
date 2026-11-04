import {CALENDAR_LIST_FIELDS,CALENDAR_EVENTS_FIELDS,CALENDAR_EVENT_FIELDS} from '../shared/companion-calendar';
import type {GoogleFetch} from './companion-google-network';
export function calendarNetworkFetch(network:{fetch:GoogleFetch}):GoogleFetch{
 return async(url,init={})=>{
  const u=new URL(url),method=(init.method??'GET').toUpperCase(),p=u.searchParams;
  const only=(names:string[])=>[...p.keys()].every(k=>names.includes(k))&&names.every(k=>p.getAll(k).length<=1);
  const token=u.origin==='https://oauth2.googleapis.com'&&u.pathname==='/token'&&!u.search&&method==='POST';
  const list=u.pathname==='/calendar/v3/users/me/calendarList'&&only(['maxResults','minAccessRole','fields'])&&p.get('maxResults')==='100'&&p.get('minAccessRole')==='reader'&&p.get('fields')===CALENDAR_LIST_FIELDS;
  const parts=/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([A-Za-z0-9_-]{1,1024}))?$/.exec(u.pathname);
  let idValid=false;try{idValid=!!parts&&/^[^\\/\x00-\x20]{1,1024}$/.test(decodeURIComponent(parts[1]));}catch{}
  const query=idValid&&parts&&!parts[2]&&only(['timeMin','timeMax','maxResults','singleEvents','showDeleted','orderBy','fields','pageToken'])&&p.get('maxResults')==='100'&&p.get('singleEvents')==='true'&&p.get('showDeleted')==='false'&&p.get('orderBy')==='startTime'&&p.get('fields')===CALENDAR_EVENTS_FIELDS&&(p.get('pageToken')?.length??0)<=2048&&[p.get('timeMin'),p.get('timeMax')].every(v=>typeof v==='string'&&v.length<=35&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v)))&&Date.parse(p.get('timeMax')!)>Date.parse(p.get('timeMin')!)&&Date.parse(p.get('timeMax')!)-Date.parse(p.get('timeMin')!)<=47*86400000;
  const detail=idValid&&parts?.[2]&&only(['fields'])&&p.get('fields')===CALENDAR_EVENT_FIELDS;
  const read=u.origin==='https://www.googleapis.com'&&method==='GET'&&init.body==null&&(list||query||detail);
  if(u.username||u.password||u.hash||!token&&!read)throw Error('Destino de Calendar no permitido.');
  return network.fetch(u.href,{...init,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',bypassCustomProtocolHandlers:true} as RequestInit);
 };
}
