import {z} from 'zod';

export const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
});
const zone=z.string().min(1).max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}});
const text=z.string().max(4000);
export const CalendarSource=z.object({
 accountId:z.string().min(1).max(300),id:z.string().min(1).max(500),name:z.string().min(1).max(160),writable:z.boolean(),
}).strict();
export type CalendarSource=z.infer<typeof CalendarSource>;
export const CalendarEvent=z.object({
 id:z.string().min(1).max(500),accountId:z.string().min(1).max(300),calendarId:z.string().min(1).max(500),
 title:z.string().trim().min(1).max(240),start:z.string().max(80),end:z.string().max(80),allDay:z.boolean(),timeZone:zone,
 description:text.default(''),location:z.string().max(500).default(''),cancelled:z.boolean().default(false),
 attendance:z.enum(['accepted','tentative','declined']).optional(),
 workMode:z.enum(['office','remote']).optional(),kind:z.literal('meeting').optional(),
}).strict().refine(event=>event.allDay
 ?calendarDate.safeParse(event.start).success&&calendarDate.safeParse(event.end).success&&event.end>event.start
 :[event.start,event.end].every(value=>/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value)))&&Date.parse(event.end)>Date.parse(event.start));
export type CalendarEvent=z.infer<typeof CalendarEvent>;
export const CalendarLibrary=z.object({version:z.literal(1),events:z.array(CalendarEvent).max(10000)
 .refine(events=>events.every(event=>event.accountId==='zen-local'&&event.calendarId==='local'))}).strict();
export const CalendarRange=z.object({start:calendarDate,end:calendarDate,timeZone:zone}).strict().refine(range=>range.end>range.start);
export type CalendarRange=z.infer<typeof CalendarRange>;
export const CalendarDraft=z.object({
 id:z.uuid(),title:z.string().trim().min(1).max(240),date:calendarDate,endDate:calendarDate,
 start:z.string().regex(/^\d\d:\d\d$/),end:z.string().regex(/^\d\d:\d\d$/),allDay:z.boolean(),timeZone:zone,
 destination:z.string().max(810),description:text,location:z.string().max(500),
}).strict();
export type CalendarDraft=z.infer<typeof CalendarDraft>;
export const CalendarAction=z.discriminatedUnion('type',[
 z.object({type:z.literal('read')}).strict(),
 z.object({type:z.literal('refresh'),range:CalendarRange,sources:z.array(z.string().max(810)).max(100)}).strict(),
 z.object({type:z.literal('create'),draft:CalendarDraft}).strict(),
]);
export type CalendarAction=z.infer<typeof CalendarAction>;
export const CalendarReply=z.discriminatedUnion('type',[
 z.object({version:z.literal(1),type:z.literal('events'),range:CalendarRange,sources:z.array(CalendarSource).max(100),
  coverage:z.array(z.object({accountId:z.string(),calendarId:z.string(),complete:z.boolean()}).strict()).max(100),
  events:z.array(CalendarEvent).max(5000)}).strict(),
 z.object({version:z.literal(1),type:z.literal('created'),event:CalendarEvent}).strict(),
 z.object({version:z.literal(1),type:z.literal('error'),message:z.string().min(1).max(500)}).strict(),
]);
export type CalendarReply=z.infer<typeof CalendarReply>;
export const sourceKey=(source:Pick<CalendarSource,'accountId'|'id'>)=>JSON.stringify([source.accountId,source.id]);
export const eventKey=(event:CalendarEvent)=>JSON.stringify([event.accountId,event.calendarId,event.id]);
export type CalendarOperation={id:string;type:'events'|'created';status:'waiting'|'uncertain'|'error';at:number;message?:string;range?:CalendarRange;draftId?:string};
export type CalendarSnapshot={
 events:CalendarEvent[];sources:CalendarSource[];operations:CalendarOperation[];
 coverage:{range:CalendarRange;source:string;complete:boolean;at:number}[];canRequest:boolean;
 confirmations:{draftId:string;eventKey:string}[];
};
export function addCalendarDays(value:string,days:number) {
 const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function calendarDateInZone(value:Date,timeZone:string) {
 const parts=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 const part=(type:string)=>parts.find(value=>value.type===type)!.value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
export function calendarGrid(month:string) {
 const first=month.slice(0,7)+'-01',weekday=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const start=addCalendarDays(first,-weekday);
 return Array.from({length:42},(_,index)=>addCalendarDays(start,index));
}

/** Resolve the civil time against the actual zone, rejecting DST gaps and repeated hours. */
const instants=new Map<string,string>();
export function calendarInstant(date:string,time:string,timeZone:string):string {
 calendarDate.parse(date);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('La hora no es válida.');
 const target=date+'T'+time,base=Date.parse(target+':00Z');
 const key=target+'@'+timeZone;
 const cached=instants.get(key);if(cached)return cached;
 const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const matches:string[]=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){
  const candidate=new Date(base-offset*60000),parts=format.formatToParts(candidate);
  const p=(type:string)=>parts.find(part=>part.type===type)!.value;
  if(p('year')+'-'+p('month')+'-'+p('day')+'T'+p('hour')+':'+p('minute')===target)matches.push(candidate.toISOString());
 }
 if(matches.length!==1)throw Error(matches.length?'Esta hora se repite por el cambio de horario. Elige una hora inequívoca.':'Esta hora no existe en la zona seleccionada por el cambio de horario.');
 if(instants.size>512)instants.clear();
 instants.set(key,matches[0]);return matches[0];
}
export function calendarDraftEvent(draft:CalendarDraft):CalendarEvent {
 const start=draft.allDay?draft.date:calendarInstant(draft.date,draft.start,draft.timeZone);
 const end=draft.allDay?addCalendarDays(draft.endDate,1):calendarInstant(draft.endDate,draft.end,draft.timeZone);
 if(end<=start)throw Error('El final debe ser posterior al inicio.');
 return CalendarEvent.parse({id:draft.id,accountId:'zen-local',calendarId:'local',title:draft.title,start,end,
  allDay:draft.allDay,timeZone:draft.timeZone,description:draft.description,location:draft.location});
}
const dayStarts=new Map<string,number>();
/** Reading a civil day uses its first real instant, even when midnight repeats or is skipped. */
function calendarDayStart(date:string,timeZone:string) {
 const key=date+'@'+timeZone,cached=dayStarts.get(key);
 if(cached!==undefined)return cached;
 const format=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const localDate=(instant:number)=>{
  const parts=format.formatToParts(new Date(instant));
  const part=(type:string)=>parts.find(value=>value.type===type)!.value;
  return part('year')+'-'+part('month')+'-'+part('day');
 };
 const base=Date.parse(date+'T00:00:00Z');
 let before=base-36*3600000,after=base+36*3600000;
 while(after-before>1){
  const middle=Math.floor((before+after)/2);
  if(localDate(middle)<date)before=middle;else after=middle;
 }
 if(dayStarts.size>512)dayStarts.clear();
 dayStarts.set(key,after);return after;
}
export function calendarOverlaps(event:CalendarEvent,range:CalendarRange) {
 if(event.cancelled||event.attendance==='declined')return false;
 if(event.allDay)return event.start<range.end&&event.end>range.start;
 const start=calendarDayStart(range.start,range.timeZone),end=calendarDayStart(range.end,range.timeZone);
 return start<end&&Date.parse(event.start)<end&&Date.parse(event.end)>start;
}

export function nextCalendarEvent(events:readonly CalendarEvent[],now:Date,timeZone:string):CalendarEvent|undefined {
 const today=calendarDateInZone(now,timeZone);
 let timed:CalendarEvent|undefined,allDay:CalendarEvent|undefined,nearest=Infinity;
 for(const event of events){
  if(event.cancelled||event.attendance==='declined')continue;
  if(event.allDay){
   if(event.start>today&&(!allDay||event.start<allDay.start))allDay=event;
   continue;
  }
  const start=Date.parse(event.start);
  if(start>+now&&start<nearest){timed=event;nearest=start;}
 }
 return allDay&&calendarDayStart(allDay.start,timeZone)<=nearest?allDay:timed;
}
