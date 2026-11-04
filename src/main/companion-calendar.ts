import {randomUUID} from 'node:crypto';
import {parseDocument} from 'htmlparser2';
import {isTag,isText,type AnyNode} from 'domhandler';
import {CalendarOAuth,type CalendarOAuthDeps} from './companion-calendar-oauth';
import {CalendarQuery,CALENDAR_LIST_FIELDS,CALENDAR_EVENTS_FIELDS,CALENDAR_EVENT_FIELDS,type CalendarList,type CalendarEvents,type CalendarEvent,type CalendarEventDetail} from '../shared/companion-calendar';

const clean=(raw:unknown,n:number)=>typeof raw==='string'?raw.replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'').slice(0,n):'';
const calendarId=(value:unknown):value is string=>typeof value==='string'&&/^[^\\/\x00-\x20]{1,1024}$/.test(value);
const eventId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,1024}$/.test(value);
function eventLink(raw:unknown){try{if(typeof raw!=='string'||raw.length>4096)return;const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.hash)return;if(u.hostname==='www.google.com'&&u.pathname==='/calendar/event'||u.hostname==='calendar.google.com'&&/^\/calendar\/(?:event|r\/eventedit\/[^/]+)$/.test(u.pathname))return u.href;}catch{}return;}
function date(raw:any){if(typeof raw?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.date)&&Number.isFinite(Date.parse(raw.date))&&new Date(raw.date).toISOString().slice(0,10)===raw.date)return{value:raw.date,allDay:true};if(typeof raw?.dateTime==='string'&&raw.dateTime.length<=50&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.dateTime)&&Number.isFinite(Date.parse(raw.dateTime)))return{value:raw.dateTime,allDay:false};return;}
function description(raw:unknown){
 const text=typeof raw==='string'?raw:'',out:string[]=[];let count=0,truncated=text.length>32000;
 const visit=(node:AnyNode,depth:number)=>{if(++count>10000||depth>40){truncated=true;return;}if(isText(node)){out.push(node.data);return;}if(isTag(node)&&['script','style','template','head','noscript','iframe','object','embed','svg','form','video','audio'].includes(node.name))return;if(isTag(node)&&['p','div','br','li','tr'].includes(node.name))out.push('\n');if('children'in node)for(const child of node.children)visit(child,depth+1);};
 for(const node of parseDocument(text.slice(0,32000),{decodeEntities:true}).children)visit(node,0);
 const value=out.join('').replace(/\n{3,}/g,'\n\n').trim();return{text:clean(value,16000),truncated:truncated||value.length>16000};
}
type CalendarSource={id:string;key:string;name:string;color:string;primary:boolean;zone:string};
type EventSource={calendar:string;id:string;link?:string;value:CalendarEvent};
/** Read-only calendar data exists only behind the visible Calendar surface and current query. */
export class CompanionCalendar{
 private identity=0;private oauth:CalendarOAuth;private generation=0;private revision=0;private calendars=new Map<string,CalendarSource>();private events=new Map<string,EventSource>();
 private pages=new Set<string>();private query?:string;private count=0;private closed=false;
 constructor(private deps:CalendarOAuthDeps){this.oauth=new CalendarOAuth(deps);}
 status(){return this.oauth.status();}
 private check(){const identity=this.oauth.identityRevision();if(identity!==this.identity){this.suspendReads();this.identity=identity;}if(this.closed||!this.deps.allowed())throw Error('Abre Calendario y desactiva la pausa o Presentación.');}
 suspendReads(){this.generation++;this.revision++;this.oauth.suspendReads();this.calendars.clear();this.events.clear();this.pages.clear();this.query=undefined;this.count=0;}
 suspend(){this.suspendReads();this.oauth.suspend();}
 async connect(){this.check();this.suspendReads();return this.oauth.connect();}
 cancel(){this.check();this.suspend();return this.status();}
 disconnect(){this.check();this.suspendReads();return this.oauth.disconnect();}
 async list():Promise<CalendarList>{
  this.check();const generation=this.generation,revision=++this.revision;
  const value=await this.oauth.get('users/me/calendarList?'+new URLSearchParams({maxResults:'100',minAccessRole:'reader',fields:CALENDAR_LIST_FIELDS}),500000);
  this.check();if(generation!==this.generation||revision!==this.revision)throw Error('La consulta cambió.');if(!Array.isArray(value?.items)||value.items.length>100)throw Error('Google devolvió una lista de calendarios no válida.');
  const previous=this.calendars,next=new Map<string,CalendarSource>(),seen=new Set<string>();
  for(const item of value.items){if(!calendarId(item?.id)||seen.has(item.id)||!['reader','writer','owner','writerWithoutPrivateAccess'].includes(item.accessRole))continue;seen.add(item.id);const key=[...previous.values()].find(v=>v.id===item.id)?.key??randomUUID();next.set(key,{key,id:item.id,name:clean(item.summary,300)||'Calendario',primary:item.primary===true,color:typeof item.backgroundColor==='string'&&/^#[0-9a-f]{6}$/i.test(item.backgroundColor)?item.backgroundColor:'#b4a0ec',zone:clean(item.timeZone,100)});}
  this.calendars=next;this.events.clear();this.pages.clear();this.query=undefined;this.count=0;
  return{calendars:[...next.values()].sort((a,b)=>Number(b.primary)-Number(a.primary)||a.name.localeCompare(b.name)).map(({id,...item})=>item),limited:!!value.nextPageToken};
 }
 async range(raw:CalendarQuery):Promise<CalendarEvents>{
  this.check();const input=CalendarQuery.parse(raw),calendar=this.calendars.get(input.calendar);if(!calendar)throw Error('Selecciona un calendario de la lista actual.');
  const key=JSON.stringify([input.calendar,input.from,input.to]);
  if(input.page&&(!this.pages.has(input.page)||this.query!==key||this.count>=5))throw Error('La página ya no pertenece a esta agenda.');
  if(!input.page){this.events.clear();this.pages.clear();this.query=key;this.count=0;}
  const generation=this.generation,revision=++this.revision,current=()=>{this.check();if(generation!==this.generation||revision!==this.revision||this.calendars.get(input.calendar)!==calendar)throw Error('La consulta cambió.');};
  const params=new URLSearchParams({timeMin:new Date(Date.parse(input.from)-2*86400000).toISOString(),timeMax:new Date(Date.parse(input.to)+2*86400000).toISOString(),maxResults:'100',singleEvents:'true',showDeleted:'false',orderBy:'startTime',fields:CALENDAR_EVENTS_FIELDS});if(input.page)params.set('pageToken',input.page);
  const value=await this.oauth.get('calendars/'+encodeURIComponent(calendar.id)+'/events?'+params,1500000);current();if(!Array.isArray(value?.items)||value.items.length>100)throw Error('Google devolvió una agenda no válida.');
  const items:CalendarEvent[]=[];let omitted=0;
  for(const item of value.items){if(item?.status==='cancelled')continue;const start=date(item?.start),end=date(item?.end);if(!eventId(item?.id)||!start||!end||start.allDay!==end.allDay||Date.parse(end.value)<=Date.parse(start.value)){omitted++;continue;}
   if([...this.events.values()].some(v=>v.id===item.id&&v.calendar===calendar.id))continue;
   const key=randomUUID(),result={key,title:clean(item.summary,500)||'(Sin título)',location:clean(item.location,2000),start:start.value,end:end.value,allDay:start.allDay,recurring:typeof item.recurringEventId==='string'};
   this.events.set(key,{calendar:calendar.id,id:item.id,link:eventLink(item.htmlLink),value:result});items.push({...result});
  }
  this.count++;if(input.page)this.pages.delete(input.page);
  const hasMore=typeof value.nextPageToken==='string'&&!!value.nextPageToken,next=hasMore&&value.nextPageToken.length<=2048&&value.nextPageToken!==input.page&&this.count<5?value.nextPageToken as string:undefined;if(next)this.pages.add(next);
  return{events:items,next,limited:hasMore&&!next||omitted>0,zone:clean(value.timeZone,100)||calendar.zone,checkedAt:Date.now()};
 }
 async detail(key:string):Promise<CalendarEventDetail>{
  this.check();const source=this.events.get(key);if(!source)throw Error('Elige un evento de la agenda actual.');const generation=this.generation,revision=this.revision;
  const value=await this.oauth.get('calendars/'+encodeURIComponent(source.calendar)+'/events/'+encodeURIComponent(source.id)+'?'+new URLSearchParams({fields:CALENDAR_EVENT_FIELDS}),250000);
  this.check();if(generation!==this.generation||revision!==this.revision||this.events.get(key)!==source)throw Error('El evento cambió. Vuelve a abrirlo.');if(value?.id!==source.id||value?.status==='cancelled')throw Error('El evento ya no está disponible. Actualiza la agenda.');
  const start=date(value.start),end=date(value.end);if(!start||!end||start.allDay!==end.allDay||Date.parse(end.value)<=Date.parse(start.value))throw Error('El horario del evento no está disponible.');
  const text=description(value.description),attendees=Array.isArray(value.attendees)?value.attendees:[];source.link=eventLink(value.htmlLink);
  return{...source.value,title:clean(value.summary,500)||'(Sin título)',location:clean(value.location,2000),start:start.value,end:end.value,allDay:start.allDay,description:text.text,descriptionTruncated:text.truncated,organizer:clean(value.organizer?.displayName||value.organizer?.email,300),attendees:attendees.slice(0,20).map((a:any)=>({name:clean(a?.displayName||a?.email,300)||'Invitado',response:['accepted','declined','tentative','needsAction'].includes(a?.responseStatus)?a.responseStatus:'needsAction',self:a?.self===true})),attendeesOmitted:Math.max(0,attendees.length-20),canOpen:!!source.link};
 }
 async openEvent(key:string){this.check();const source=this.events.get(key);if(!source?.link)throw Error('Elige un evento de la agenda actual.');await this.deps.open(source.link);return true;}
 close(){this.closed=true;this.suspendReads();this.oauth.close();}
}
