import {z} from 'zod';
export const CALENDAR_SCOPES=['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.readonly'] as const;
export const CALENDAR_LIST_FIELDS='nextPageToken,items(id,summary,primary,backgroundColor,timeZone,accessRole)';
export const CALENDAR_EVENT_FIELDS='id,status,summary,description,location,start,end,htmlLink,organizer(displayName,email),attendees(displayName,email,responseStatus,self),recurringEventId';
export const CALENDAR_EVENTS_FIELDS='timeZone,nextPageToken,items(id,status,summary,location,start,end,htmlLink,recurringEventId)';
export type CalendarState={view?:string;configured:boolean;credentialsReady:boolean;connected:boolean;authorizing:boolean;error?:string};
export type CalendarItem={key:string;name:string;color:string;primary:boolean;zone:string};
export type CalendarList={calendars:CalendarItem[];limited:boolean};
export type CalendarEvent={key:string;title:string;location:string;start:string;end:string;allDay:boolean;recurring:boolean};
export type CalendarEvents={events:CalendarEvent[];next?:string;limited:boolean;zone:string;checkedAt:number};
export type CalendarEventDetail=CalendarEvent&{description:string;descriptionTruncated:boolean;organizer:string;attendees:{name:string;response:string;self:boolean}[];attendeesOmitted:number;canOpen:boolean};
export const CalendarQuery=z.object({calendar:z.string().uuid(),from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true}),page:z.string().min(1).max(2048).optional()}).strict().refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=43*86400000,'Selecciona un intervalo de hasta seis semanas.');
export type CalendarQuery=z.infer<typeof CalendarQuery>;
export function calendarMonth(year:number,month:number){
 const first=new Date(year,month,1),start=new Date(year,month,1-(first.getDay()+6)%7),end=new Date(start);end.setDate(end.getDate()+42);
 const day=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 return{from:start.toISOString(),to:end.toISOString(),days:Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return{date:day(d),day:d.getDate(),current:d.getMonth()===month};})};
}
/** All-day ends are exclusive calendar dates; timed events use the viewer's local day. */
export function calendarEventsOnDay(events:CalendarEvent[],day:string){
 const start=new Date(day+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
 const next=[end.getFullYear(),String(end.getMonth()+1).padStart(2,'0'),String(end.getDate()).padStart(2,'0')].join('-');
 return events.filter(e=>e.allDay?e.start<next&&e.end>day:Date.parse(e.start)<end.getTime()&&Date.parse(e.end)>start.getTime());
}
