import {z} from 'zod';
import {calendarDate} from './companion-calendar';

export const officeMode=z.enum(['office','remote']);
export const DailyHomePreferences=z.object({
 enabled:z.boolean().default(true),
 useCalendar:z.boolean().default(true),
 animateWeather:z.boolean().default(true),
 officeDays:z.array(z.number().int().min(0).max(6)).max(7).default([]),
 exceptions:z.record(calendarDate,z.enum(['office','remote','unspecified'])).refine(value=>Object.keys(value).length<=366).default({}),
}).strict();
export type DailyHomePreferences=z.infer<typeof DailyHomePreferences>;
export const DailyHomeAction=z.discriminatedUnion('type',[
 z.object({type:z.literal('read')}).strict(),
 z.object({type:z.literal('save'),preferences:DailyHomePreferences}).strict(),
]);
export type DailyHomeAction=z.infer<typeof DailyHomeAction>;

export type HomeBrief={
 animateWeather:boolean;
 summary?:{
  greeting:string;
  message:string;
  source:'local';
  next?:{day:string;time?:string;kind:'meeting'|'event';ongoing:boolean;source:'local'|'synchronized'};
  work?:{mode:'office'|'remote'|'ambiguous';source:'event'|'exception'|'routine'|'hint'|'conflict'};
 };
};
