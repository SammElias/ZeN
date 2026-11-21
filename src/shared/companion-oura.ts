import {z} from 'zod';
import {addCalendarDays,calendarDate} from './companion-calendar';

export const ouraRedirect='http://localhost:46328/oura/callback';
export const ouraLegal={
 privacy:'https://github.com/SammElias/ZeN/blob/main/docs/OURA_PRIVACY_POLICY.md',
 terms:'https://github.com/SammElias/ZeN/blob/main/docs/OURA_TERMS_OF_SERVICE.md',
} as const;
export const ouraClientId=z.string().trim().min(1).max(160).regex(/^[a-z\d_-]+$/i);
export const ouraCapsuleMode=z.enum(['icon','sleep']);
export const OuraAction=z.discriminatedUnion('type',[
 z.object({type:z.literal('connect'),clientId:ouraClientId}).strict(),
 z.object({type:z.literal('cancel')}).strict(),
 z.object({type:z.literal('refresh')}).strict(),
 z.object({type:z.literal('disconnect')}).strict(),
 z.object({type:z.literal('capsule'),mode:ouraCapsuleMode}).strict(),
 z.object({type:z.literal('legal'),page:z.enum(['privacy','terms'])}).strict(),
]);
export type OuraAction=z.infer<typeof OuraAction>;
export type OuraCapsuleMode=z.infer<typeof ouraCapsuleMode>;

export const ouraResources=['daily_sleep','sleep','daily_readiness','daily_activity'] as const;
export type OuraResource=typeof ouraResources[number];
export const ouraNumber=z.number().int().nonnegative();
export const ouraScore=ouraNumber.max(100);
export const ouraCache=z.object({
 daily_sleep:z.record(calendarDate,ouraScore),sleep:z.record(calendarDate,ouraNumber.max(86400)),
 daily_readiness:z.record(calendarDate,ouraScore),daily_activity:z.record(calendarDate,z.object({steps:ouraNumber.optional(),score:ouraScore.optional()}).strict()),
 checked:z.partialRecord(z.enum(ouraResources),ouraNumber),
}).strict();
export type OuraCache=z.infer<typeof ouraCache>;
export const emptyOuraCache=():OuraCache=>({daily_sleep:{},sleep:{},daily_readiness:{},daily_activity:{},checked:{}});

export type OuraMetric='sleep'|'readiness'|'activity';
export type OuraPoint={day:string;score?:number;seconds?:number;steps?:number};
export const metricResources={sleep:['sleep','daily_sleep'],readiness:['daily_readiness'],activity:['daily_activity']} as const;
export type OuraStatus={
 state:'disconnected'|'connecting'|'connected'|'expired';clientId:string;capsule:OuraCapsuleMode;busy:boolean;demo?:boolean;
 today:string;cache:OuraCache;error?:string;
};
export type OuraGlance={day:string;seconds:number;current:boolean};
export type OuraHomeSleep={state:Exclude<OuraStatus['state'],'connected'>}|
 {state:'connected';today:string;latest?:Pick<OuraPoint,'day'|'seconds'|'score'>};

export function ouraPoint(cache:OuraCache,metric:OuraMetric,day:string):OuraPoint {
 if(metric==='sleep')return{day,seconds:cache.sleep[day],score:cache.daily_sleep[day]};
 if(metric==='readiness')return{day,score:cache.daily_readiness[day]};
 return {day,...cache.daily_activity[day]};
}
export function ouraLatest(cache:OuraCache,metric:OuraMetric,today:string):OuraPoint|undefined{
 const dates=metricResources[metric].flatMap(resource=>Object.keys(cache[resource]));
 const day=dates.filter(value=>value<=today).sort().at(-1);
 return day?ouraPoint(cache,metric,day):undefined;
}
export function ouraWeek(cache:OuraCache,metric:OuraMetric,today:string){
 return Array.from({length:7},(_,i)=>ouraPoint(cache,metric,addCalendarDays(today,i-6)));
}
export function ouraDuration(seconds:number,compact=false){
 const minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60),remainder=minutes%60;
 return compact?`${hours}h${String(remainder).padStart(2,'0')}`:`${hours} h ${remainder} min`;
}
