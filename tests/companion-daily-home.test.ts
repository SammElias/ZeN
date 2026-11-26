import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CompanionDailyHome} from '../src/main/companion-daily-home';
import {CompanionCalendar,type DailyCalendarEvent} from '../src/main/companion-calendar';
import type {CalendarEvent} from '../src/shared/companion-calendar';
import {dublinWeather,type WeatherStatus} from '../src/shared/companion-weather';

const localTime=new Date('2026-11-23T08:00:00Z');
const zone='Europe/Madrid',date='2026-11-23';
const bare:WeatherStatus={configured:false,location:dublinWeather};
const rainy:WeatherStatus={...bare,configured:true,forecast:{temperature:11,low:8,high:15,description:'Lluvia',icon:'10d',rain:true,rainChance:67,period:'today',updatedAt:+localTime}};
const event=(override:Partial<CalendarEvent>={}):CalendarEvent=>({
 id:'synthetic-opaque-identifier',accountId:'zen-local',calendarId:'local',title:'Detalle privado de prueba',description:'Solo dentro del calendario',location:'',
 start:'2026-11-23T08:30:00Z',end:'2026-11-23T09:00:00Z',timeZone:zone,allDay:false,cancelled:false,...override,
});
const observations=(...events:CalendarEvent[])=>({events:events.map(event=>({event,source:'local'} satisfies DailyCalendarEvent)),updatedAt:undefined});
let profile:string;
beforeEach(()=>{profile=mkdtempSync(join(tmpdir(),'zen-daily-home-'));});
afterEach(()=>rmSync(profile,{recursive:true,force:true}));
const readSummary=()=>JSON.parse(readFileSync(join(profile,'companion-daily-home.json'),'utf8'));

it('reuses a summary across duplicate reads and restarts, while the greeting follows the clock',()=>{
 const read=vi.fn(()=>undefined);
 const brief=new CompanionDailyHome(profile);
 expect(brief.view(localTime,zone,bare,0,read).summary?.greeting).toContain('Buenos días, Samm');
 brief.view(localTime,zone,bare,0,read);
 expect(read).toHaveBeenCalledTimes(1);
 const generatedAt=readSummary().generatedAt;
 const restarted=new CompanionDailyHome(profile);
 expect(restarted.view(new Date('2026-11-23T21:00:00Z'),zone,bare,0,read).summary?.greeting).toContain('Buenas noches, Samm');
 expect(readSummary().generatedAt).toBe(generatedAt);
 restarted.view(new Date('2026-11-23T23:05:00Z'),zone,bare,0,read);
 expect(readSummary()).toMatchObject({date:'2026-11-24',zone,source:'local'});
 restarted.view(new Date('2026-11-23T23:05:00Z'),'Europe/Dublin',bare,0,read);
 expect(readSummary()).toMatchObject({date,zone:'Europe/Dublin'});
});

it('uses only fresh forecasts and regroups minor weather updates without generating another message',()=>{
 const brief=new CompanionDailyHome(profile);
 const open=(at:number,weather:WeatherStatus)=>brief.view(new Date(at),zone,weather,0,()=>undefined).summary;
 expect(open(+localTime,rainy)?.message).toContain('paraguas');
 const generatedAt=readSummary().generatedAt;
 const later=+localTime+60_000;
 expect(open(later,{...rainy,forecast:{...rainy.forecast!,rainChance:71,updatedAt:later}})?.message).toContain('paraguas');
 expect(readSummary().generatedAt).toBe(generatedAt);
 const stale=+localTime+3*3600000;
 expect(open(stale,rainy)?.message).not.toContain('paraguas');
 expect(readSummary().generatedAt).toBe(stale);
});

it('distinguishes explicit office or remote work, the weekly routine, dated exceptions and uncertain hints',()=>{
 const brief=new CompanionDailyHome(profile);
 let revision=0;
 const show=(...events:CalendarEvent[])=>brief.view(localTime,zone,bare,++revision,()=>observations(...events)).summary?.work;
 expect(show(event({kind:'meeting'}))).toBeUndefined();
 expect(show(event({location:'Oficina'}))).toEqual({mode:'office',source:'hint'});
 expect(show(event({title:'[oficina] jornada'}))).toEqual({mode:'office',source:'event'});
 brief.save({...brief.preferences,officeDays:[1]});
 expect(show()).toEqual({mode:'office',source:'routine'});
 expect(show(event({workMode:'remote'}))).toEqual({mode:'remote',source:'event'});
 brief.save({...brief.preferences,exceptions:{[date]:'remote'}});
 expect(show()).toEqual({mode:'remote',source:'exception'});
 expect(show(event({workMode:'office'}))).toEqual({mode:'ambiguous',source:'conflict'});
 brief.save({...brief.preferences,exceptions:{[date]:'unspecified'}});
 expect(show()).toBeUndefined();
});

it('updates a changed or deleted commitment, handles all-day entries and invalidates when agenda is disabled',()=>{
 const brief=new CompanionDailyHome(profile);
 const show=(revision:number,...events:CalendarEvent[])=>brief.view(localTime,zone,bare,revision,()=>observations(...events)).summary;
 const meeting=event({kind:'meeting'});
 expect(show(1,event({cancelled:true}),event({attendance:'declined'}),meeting)?.next).toMatchObject({day:date,time:'09:30',kind:'meeting'});
 const first=readSummary().fingerprint;
 expect(show(2,{...meeting,start:'2026-11-23T09:00:00Z',end:'2026-11-23T10:00:00Z'})?.next?.time).toBe('10:00');
 expect(readSummary().fingerprint).not.toBe(first);
 const allDay=event({start:'2026-11-22',end:'2026-11-24',allDay:true});
 expect(show(3,allDay)?.next).toMatchObject({day:date,ongoing:true,kind:'event'});
 expect(show(4)?.next).toBeUndefined();
 show(5,meeting);
 const file=join(profile,'companion-daily-home.json'),cached=readFileSync(file,'utf8');
 for(const value of [meeting.title,meeting.description,meeting.id,meeting.start])expect(cached).not.toContain(value);
 brief.save({...brief.preferences,useCalendar:false});
 expect(existsSync(file)).toBe(false);
 const unavailable=vi.fn(()=>observations(meeting));
 const restored=new CompanionDailyHome(profile).view(localTime,zone,bare,5,unavailable).summary;
 expect(restored?.next).toBeUndefined();
 expect(unavailable).not.toHaveBeenCalled();
});

it('reads existing recurrence instances only while their synchronized range is fresh',()=>{
 const range={start:date,end:'2026-11-30',timeZone:zone}, file=join(profile,'calendar.json');
 const accountId='test-account',calendarId='test-calendar';
 const seriesEvent=event({accountId,calendarId});
 const nextInstance=event({id:'next-instance',accountId,calendarId,start:'2026-11-24T08:30:00Z',end:'2026-11-24T09:00:00Z'});
 const local=event({allDay:true,start:date,end:'2026-11-24'});
 writeFileSync(file,JSON.stringify({version:1,events:[seriesEvent,nextInstance,local,{...seriesEvent,attendance:'declined'}],
  sources:[{accountId,id:calendarId,name:'Calendario de prueba',writable:false}],
  coverage:[{source:JSON.stringify([accountId,calendarId]),range,complete:true,at:+localTime}]}));
 const calendar=new CompanionCalendar(file,{policy:()=>({visible:false,allowed:true}),queue:vi.fn(),changed:vi.fn()});
 expect(calendar.dailyEvents(range,+localTime)?.events.map(item=>item.event.id)).toEqual([seriesEvent.id,nextInstance.id,local.id]);
 expect(calendar.dailyEvents(range,+localTime+25*3600000)?.events.map(item=>item.source)).toEqual(['local']);
 expect(()=>calendar.snapshot()).toThrow('Abre Calendario');
});
