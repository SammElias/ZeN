import {z} from 'zod';
import {addCalendarDays,calendarDate} from '../shared/companion-calendar';
import {ouraNumber,ouraScore,type OuraCache,type OuraResource} from '../shared/companion-oura';

const fields={daily_sleep:'day,score',sleep:'day,type,total_sleep_duration,bedtime_end',daily_readiness:'day,score',daily_activity:'day,steps,score'};
const pageShape=z.object({data:z.array(z.unknown()).max(1000),next_token:z.string().max(4096).nullish()});
const dated=z.object({day:calendarDate,score:ouraScore.nullish()});
const activity=dated.extend({steps:ouraNumber.nullish()});
const sleep=z.object({day:calendarDate,type:z.string().nullish(),total_sleep_duration:ouraNumber.max(86400).nullish(),bedtime_end:z.string()});

export class OuraHttpError extends Error {
 constructor(readonly status:number,readonly retryAt=0){super('Oura Cloud no completó la consulta.');}
}

function requestOura(url:URL,token:string,signal:AbortSignal){
 return fetch(url,{signal,redirect:'error',
  headers:{Authorization:`Bearer ${token}`,'User-Agent':'ZEN-Oura/1.0',Accept:'application/json'}});
}

export async function verifyOuraDaily(token:string,day:string,signal:AbortSignal):Promise<void>{
 const url=new URL('https://api.ouraring.com/v2/usercollection/daily_sleep');
 url.search=new URLSearchParams({start_date:day,end_date:addCalendarDays(day,1),fields:'day'}).toString();
 const response=await requestOura(url,token,signal);
 // Only the resource server's authorization decision is needed here.
 await response.body?.cancel().catch(()=>{});
 if(response.status!==200)throw new OuraHttpError(response.status);
}

export async function readOura(resource:OuraResource,start:string,end:string,token:string,signal:AbortSignal):Promise<unknown[]> {
 const url=new URL(`https://api.ouraring.com/v2/usercollection/${resource}`);
 url.search=new URLSearchParams({start_date:start,end_date:end,fields:fields[resource]}).toString();
 const rows:unknown[]=[],seen=new Set<string>();
 for(let i=0;i<12;i++){
  const res=await requestOura(url,token,AbortSignal.any([signal,AbortSignal.timeout(15000)]));
  if(!res.ok){
   const now=Date.now(),retry=res.headers.get('retry-after')??'',reset=Number(res.headers.get('x-ratelimit-reset'))*1000;
   const after=/^\d+$/.test(retry)?now+Number(retry)*1000:Date.parse(retry);
   throw new OuraHttpError(res.status,Math.max(Number.isFinite(after)?after:0,Number.isFinite(reset)?reset:0));
  }
  const page=pageShape.parse(await res.json());
  rows.push(...page.data);
  if(!page.next_token)return rows;
  if(seen.has(page.next_token))break;
  seen.add(page.next_token);url.searchParams.set('next_token',page.next_token);
 }
 throw Error('Oura no completó todas las páginas.');
}

export function mergeOuraRows(cache:OuraCache,resource:OuraResource,rows:unknown[],start:string,today:string){
 const primary=new Map<string,{seconds:number;end:number}>();
 for(const row of rows){
  const day=calendarDate.safeParse((row as Record<string,unknown>|null)?.day);
  if(!day.success||day.data<start||day.data>today)continue;
  if(resource==='sleep'){
   const result=sleep.safeParse(row);
   if(!result.success||result.data.type!=='long_sleep'||!result.data.total_sleep_duration)continue;
   const seconds=result.data.total_sleep_duration,end=Date.parse(result.data.bedtime_end),last=primary.get(day.data);
   if(Number.isFinite(end)&&(!last||seconds>last.seconds||seconds===last.seconds&&end>last.end))primary.set(day.data,{seconds,end});
  }else if(resource==='daily_activity'){
   const result=activity.safeParse(row);
   if(result.success){
    const score=result.data.score??undefined,steps=result.data.steps??undefined;
    const old=cache.daily_activity[day.data];
    if(score!==undefined||steps!==undefined)cache.daily_activity[day.data]={steps:steps??old?.steps,score:score??old?.score};
   }
  }else{
   const result=dated.safeParse(row);
   if(result.success&&result.data.score!=null)cache[resource][day.data]=result.data.score;
  }
 }
 for(const [day,{seconds}] of primary)cache.sleep[day]=seconds;
}
