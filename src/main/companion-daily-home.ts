import {createHash} from 'node:crypto';
import {readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {addCalendarDays,calendarDate,calendarDateInZone,calendarOverlaps,eventKey,nextCalendarEvent,type CalendarRange} from '../shared/companion-calendar';
import {DailyHomePreferences,type HomeBrief} from '../shared/companion-daily-home';
import {isFreshWeather,type WeatherForecast,type WeatherStatus} from '../shared/companion-weather';
import type {CompanionCalendar,DailyCalendarEvent} from './companion-calendar';

type Summary=NonNullable<HomeBrief['summary']>;
type Work=NonNullable<Summary['work']>;
type CalendarContext=ReturnType<CompanionCalendar['dailyEvents']>;
type OfficeMode='office'|'remote';
type Tip='rain'|'cold'|'heat'|'wind'|'snow'|'clear'|'cloud'|'neutral';

const cacheSchema=z.object({
 version:z.literal(1),date:calendarDate,zone:z.string().min(1).max(100),generatedAt:z.number().int().nonnegative(),
 source:z.literal('local'),fingerprint:z.string().regex(/^[a-f\d]{64}$/),message:z.string().min(1).max(240),
}).strict();
type CachedSummary=z.infer<typeof cacheSchema>;

function read<T>(file:string,schema:z.ZodType<T>):T|undefined{
 try{return schema.parse(JSON.parse(readFileSync(file,'utf8')));}catch{return undefined;}
}

function write(file:string,value:unknown){
 const temporary=file+'.tmp';
 try{writeFileSync(temporary,JSON.stringify(value),{mode:0o600});renameSync(temporary,file);}
 finally{try{rmSync(temporary,{force:true});}catch{/* A failed write never replaces the previous value. */}}
}

const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function eventModes(event:DailyCalendarEvent['event'],explicit:boolean):OfficeMode[]{
 const title=normalize(event.title);
 if(explicit)return [
  ...(event.workMode?[event.workMode]:[]),
  ...(/\[oficina\]/.test(title)?['office' as const]:[]),
  ...(/\[teletrabajo\]/.test(title)?['remote' as const]:[]),
 ];
 const text=title+' '+normalize(event.location);
 return [
  ...(/\b(?:oficina|office|presencial)\b/.test(text)?['office' as const]:[]),
  ...(/\b(?:teletrabajo|remoto|remote)\b/.test(text)?['remote' as const]:[]),
 ];
}

function workMode(today:CalendarRange,entries:DailyCalendarEvent[],preferences:DailyHomePreferences):Work|undefined{
 const events=entries.map(({event})=>event).filter(event=>event.attendance!=='tentative'&&calendarOverlaps(event,today));
 const explicit=new Set(events.flatMap(event=>eventModes(event,true)));
 const exception=preferences.exceptions[today.start];
 if(exception&&exception!=='unspecified')explicit.add(exception);
 if(explicit.size>1)return {mode:'ambiguous',source:'conflict'};
 const [mode]=explicit;
 if(mode)return {mode,source:exception===mode?'exception':'event'};
 if(exception==='unspecified')return undefined;
 const hints=new Set(events.flatMap(event=>eventModes(event,false)));
 if(hints.size>1)return {mode:'ambiguous',source:'conflict'};
 const [hint]=hints;
 const weekday=new Date(today.start+'T12:00:00Z').getUTCDay();
 if(preferences.officeDays.includes(weekday))return hint==='remote'?{mode:'ambiguous',source:'conflict'}:{mode:'office',source:'routine'};
 if(hint)return {mode:hint,source:'hint'};
}

function nextCommitment(now:Date,today:CalendarRange,entries:DailyCalendarEvent[]){
 const active=entries.map(({event})=>event).filter(event=>!event.cancelled&&event.attendance!=='declined'&&event.attendance!=='tentative');
 const daily=active.filter(event=>calendarOverlaps(event,today));
 const timed=daily.filter(event=>!event.allDay).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 const upcoming=timed.find(event=>Date.parse(event.start)>=+now);
 const current=timed.find(event=>Date.parse(event.start)<=+now&&Date.parse(event.end)>+now)??daily.find(event=>event.allDay);
 const event=upcoming??current??nextCalendarEvent(active,now,today.timeZone);
 if(!event)return undefined;
 const start=new Date(event.start);
 const day=event.allDay?(event.start<today.start?today.start:event.start):calendarDateInZone(start,today.timeZone);
 const time=event.allDay?undefined:new Intl.DateTimeFormat('es',{timeZone:today.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(start);
 const next:NonNullable<Summary['next']>={day,time,kind:event.kind??'event',ongoing:event===current,
  source:entries.find(entry=>entry.event===event)!.source};
 return {next,key:[eventKey(event),event.start,event.end,event.attendance,event.kind]};
}

function weatherTip(forecast?:WeatherForecast):Tip{
 if(!forecast)return 'neutral';
 if(forecast.temperature<=8)return 'cold';
 if(forecast.temperature>=28)return 'heat';
 if(forecast.icon.startsWith('13'))return 'snow';
 if(forecast.rain&&forecast.period!=='tomorrow')return 'rain';
 if((forecast.windKph??0)>=36)return 'wind';
 return forecast.icon.startsWith('01d')?'clear':'cloud';
}

// A future generator can consume only these classified facts. Event text and credentials stay with their sources.
type DailyContext={
 date:string;zone:string;
 weather:{origin:'openweather';available:boolean;updatedAt?:number;location:string;tip:Tip};
 calendar:{origin:'calendar-cache';available:boolean;updatedAt?:number;work?:Work;hasCommitment:boolean};
};

const tips:Record<Exclude<Tip,'neutral'>,string>={
 rain:'Si vas a salir, ten un paraguas a mano.',
 cold:'Está fresco. Si sales, lleva una capa de abrigo.',
 heat:'Con este calor, ten agua a mano si vas a salir.',
 wind:'Si sales, cuenta con el viento y elige una capa que lo corte.',
 snow:'Si sales, usa calzado con buen agarre.',
 clear:'Con el cielo despejado, un rato al aire libre puede sentar bien.',
 cloud:'Si necesitas un descanso, cambia de ritmo un momento.',
};
const priorities=['Empieza por lo que más te importa.','Elige una cosa para empezar y ve a tu ritmo.','Reserva un rato para lo que necesita tu atención.'];

function localMessage(context:DailyContext){
 const priority=priorities[Number(context.date.slice(-2))%priorities.length];
 if(context.weather.tip!=='neutral')return `${tips[context.weather.tip]} ${priority}`;
 return context.calendar.hasCommitment?`Ten a mano tu agenda. ${priority}`:priority;
}

function greeting(now:Date,zone:string,tip:Tip){
 const hour=Number(new Intl.DateTimeFormat('es',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(now));
 const time=hour<6||hour>=20?'Buenas noches':hour<13?'Buenos días':'Buenas tardes';
 const emoji=time==='Buenas noches'?'🌙':tip==='rain'?'🌧️':tip==='snow'?'❄️':tip==='clear'?'☀️':'☕';
 return `${time} ${emoji}`;
}

export class CompanionDailyHome {
 preferences:DailyHomePreferences;
 private readonly preferencesFile:string;
 private readonly cacheFile:string;
 private cache?:CachedSummary;
 private last?:{key:string;view:HomeBrief};
 constructor(profile:string){
  this.preferencesFile=join(profile,'companion-daily-home-settings.json');
  this.cacheFile=join(profile,'companion-daily-home.json');
  this.preferences=read(this.preferencesFile,DailyHomePreferences)??DailyHomePreferences.parse({});
  this.cache=read(this.cacheFile,cacheSchema);
 }
 save(preferences:DailyHomePreferences){
  const next=DailyHomePreferences.parse({...preferences,officeDays:[...new Set(preferences.officeDays)].sort()});
  write(this.preferencesFile,next);
  if((this.preferences.useCalendar&&!next.useCalendar)||(this.preferences.enabled&&!next.enabled)){
   this.cache=undefined;
   try{rmSync(this.cacheFile,{force:true});}catch{/* A prior fingerprint cannot match the new policy. */}
  }
  this.preferences=next;
  this.last=undefined;
 }
 view(now:Date,zone:string,weather:WeatherStatus,calendarRevision:number,readCalendar:(range:CalendarRange,now:number)=>CalendarContext):HomeBrief{
  const {animateWeather,enabled,useCalendar}=this.preferences;
  if(!enabled)return {animateWeather};
  const forecast=weather.forecast;
  const fresh=forecast&&isFreshWeather(forecast,+now)?forecast:undefined;
  const location=JSON.stringify(weather.location);
  const key=JSON.stringify([Math.floor(+now/15_000),zone,location,fresh?.updatedAt,useCalendar?calendarRevision:0]);
  if(this.last?.key===key)return this.last.view;
  const date=calendarDateInZone(now,zone);
  const today={start:date,end:addCalendarDays(date,1),timeZone:zone};
  const calendar=useCalendar?readCalendar({...today,end:addCalendarDays(date,7)},+now):undefined;
  const entries=calendar?.events??[];
  const work=useCalendar?workMode(today,entries,this.preferences):undefined;
  const commitment=useCalendar?nextCommitment(now,today,entries):undefined;
  const context:DailyContext={date,zone,
   weather:{origin:'openweather',available:!!fresh,updatedAt:forecast?.updatedAt,location,tip:weatherTip(fresh)},
   calendar:{origin:'calendar-cache',available:!!calendar,updatedAt:calendar?.updatedAt,work,hasCommitment:!!commitment},
  };
  const fingerprint=createHash('sha256').update(JSON.stringify([
   date,zone,location,context.weather.tip,useCalendar,work,commitment?.next,commitment?.key,
  ])).digest('hex');
  if(this.cache?.fingerprint!==fingerprint||this.cache.date!==date||this.cache.zone!==zone){
   this.cache={version:1,date,zone,generatedAt:+now,source:'local',fingerprint,message:localMessage(context)};
   try{write(this.cacheFile,this.cache);}catch{/* The summary can still be shown for this session. */}
  }
  const view:HomeBrief={animateWeather,summary:{greeting:greeting(now,zone,context.weather.tip),message:this.cache.message,
   source:'local',next:commitment?.next,work}};
  this.last={key,view};
  return view;
 }
}
