import {describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CompanionCalendar} from '../src/main/companion-calendar';
import {CalendarDraft,CalendarEvent,calendarDraftEvent,calendarInstant,calendarGrid,calendarOverlaps,nextCalendarEvent,sourceKey} from '../src/shared/companion-calendar';

const range={start:'2026-11-01',end:'2026-12-01',timeZone:'Europe/London'};
const source={accountId:'fixture-account',id:'fixture-calendar',name:'Pruebas',writable:true};
const timed=(id='fixture-event')=>CalendarEvent.parse({id,accountId:source.accountId,calendarId:source.id,title:'Evento de prueba',
 start:'2026-11-04T10:00:00Z',end:'2026-11-04T11:00:00Z',allDay:false,timeZone:range.timeZone});
const draft=()=>CalendarDraft.parse({id:randomUUID(),title:'Evento local',date:'2026-11-04',endDate:'2026-11-04',start:'10:00',end:'11:00',
 allDay:false,timeZone:range.timeZone,destination:'local',description:'Datos de prueba',location:''});
function fixture(run:(fixture:{
 store:CompanionCalendar;path:string;sent:string[];policy:{visible:boolean;allowed:boolean;target?:{session:string;cwd:string}};
 answer:(id:string,value:unknown)=>void;deps:any;
})=>unknown){
 const root=mkdtempSync(join(tmpdir(),'zen-calendar-test-')),path=join(root,'calendar.json'),sent:string[]=[];
 const policy={visible:true,allowed:true,target:{session:'fixture-thread',cwd:'fixture-folder'}};
 const deps={policy:()=>policy,changed:()=>{},queue:async(_thread:string,text:string,verify:()=>void)=>{verify();sent.push(text);}};
 const store=new CompanionCalendar(path,deps);
 const answer=(id:string,value:unknown)=>store.observe('fixture-thread','fixture-folder','<zen_calendar id="'+id+'">'+JSON.stringify(value)+'</zen_calendar>');
 return Promise.resolve().then(()=>run({store,path,sent,policy,answer,deps})).finally(()=>rmSync(root,{recursive:true,force:true}));
}
const reply=(events:CalendarEvent[],complete=true,interval=range)=>({version:1,type:'events',range:interval,sources:[source],
 coverage:[{accountId:source.accountId,calendarId:source.id,complete}],events});

describe('calendar dates and civil times',()=>{
 it('chooses the earliest future start regardless of order, cancellations and calendar month',()=>{
  const event=timed(),past={...timed('already-started'),end:'2026-11-04T12:00:00Z'};
  const nearest={...event,start:'2026-11-04T12:10:00+01:00',end:'2026-11-04T13:00:00+01:00'};
  const later={...timed('later'),start:'2026-12-01T10:00:00Z',end:'2026-12-01T11:00:00Z'};
  const cancelled={...timed('cancelled'),start:'2026-11-04T11:05:00Z',end:'2026-11-04T12:00:00Z',cancelled:true};
  const events=[later,past,cancelled,nearest];
  expect(nextCalendarEvent(events,new Date('2026-11-04T11:00:00Z'),range.timeZone)).toBe(nearest);
  expect(nextCalendarEvent(events,new Date('2026-11-04T11:10:00Z'),range.timeZone)).toBe(later);
  expect(nextCalendarEvent(events,new Date('2026-12-02T12:00:00Z'),range.timeZone)).toBeUndefined();
 });
 it('ranks future all-day events on the calendar view date in its selected time zone',()=>{
  const allDay={...timed('all-day'),start:'2026-11-05',end:'2026-11-06',allDay:true};
  const late={...timed('late'),start:'2026-11-05T04:00:00Z',end:'2026-11-05T05:00:00Z'};
  expect(nextCalendarEvent([late,allDay],new Date('2026-11-04T22:00:00Z'),'Europe/Madrid')).toBe(allDay);
  expect(nextCalendarEvent([late,allDay],new Date('2026-11-04T23:30:00Z'),'Europe/Madrid')).toBe(late);
 });
 it('builds a Monday-first grid across month boundaries',()=>{
  const days=calendarGrid('2026-11-12');
  expect(days).toHaveLength(42);expect(days[0]).toBe('2026-10-26');expect(days[41]).toBe('2026-12-06');
 });
 it('rejects the missing and repeated civil hours at DST transitions',()=>{
  expect(()=>calendarInstant('2026-03-29','01:30','Europe/London')).toThrow('no existe');
  expect(()=>calendarInstant('2026-10-25','01:30','Europe/London')).toThrow('se repite');
  expect(calendarInstant('2026-11-04','10:00','Asia/Kathmandu')).toBe('2026-11-04T04:15:00.000Z');
 });
 it('preserves all-day dates and an exclusive multi-day end',()=>{
  const event=calendarDraftEvent({...draft(),allDay:true,date:'2026-11-04',endDate:'2026-11-06'});
  expect(event.start).toBe('2026-11-04');expect(event.end).toBe('2026-11-07');
  expect(calendarOverlaps(event,{...range,start:'2026-11-06',end:'2026-11-07'})).toBe(true);
  expect(calendarOverlaps(event,{...range,start:'2026-11-07',end:'2026-11-08'})).toBe(false);
 });
 it('includes events starting before the interval and rejects invalid times and inverted ends',()=>{
  expect(calendarOverlaps({...timed(),start:'2026-10-31T22:00:00Z',end:'2026-11-01T02:00:00Z'},range)).toBe(true);
  expect(()=>calendarDraftEvent({...draft(),end:'09:00'})).toThrow();
  expect(()=>calendarDraftEvent({...draft(),start:'25:00'})).toThrow();
 });
 it('reads days whose midnight is skipped or repeated without rejecting the agenda',()=>{
  const event={...timed(),start:'2026-03-08T05:30:00Z',end:'2026-03-08T06:30:00Z'};
  expect(calendarOverlaps(event,{start:'2026-03-08',end:'2026-03-09',timeZone:'America/Havana'})).toBe(true);
  expect(calendarOverlaps({...event,start:'2026-11-01T04:15:00Z',end:'2026-11-01T05:00:00Z'},
   {start:'2026-11-01',end:'2026-11-02',timeZone:'America/Havana'})).toBe(true);
  expect(calendarOverlaps({...event,start:'2011-12-29T10:00:00Z',end:'2011-12-31T10:00:00Z'},
   {start:'2011-12-30',end:'2011-12-31',timeZone:'Pacific/Apia'})).toBe(false);
 });
});
describe('calendar persistence and the existing Codex route',()=>{
 it('saves local events once and reloads them without a connected account',()=>fixture(async({store,path,deps,policy,sent})=>{
  policy.target=undefined as any;
  const input=draft();
  await Promise.all([store.create(input),store.create(input)]);
  expect(sent).toHaveLength(0);expect(new CompanionCalendar(path,deps).snapshot().events).toHaveLength(1);
 }));
 it('accepts only a matching structured response from the requested chat and interval',()=>fixture(async({store,answer})=>{
  await store.refresh(range,[]);
  const id=store.snapshot().operations[0].id;
  store.observe('wrong-chat','fixture-folder','<zen_calendar id="'+id+'">'+JSON.stringify(reply([timed()]))+'</zen_calendar>');
  expect(store.snapshot().events).toEqual([]);
  answer(randomUUID(),reply([timed()]));
  expect(store.snapshot().events).toEqual([]);
  answer(id,reply([timed()]));
  expect(store.snapshot().events).toEqual([timed()]);
  expect(store.snapshot().coverage[0].complete).toBe(true);
 }));
 it('deduplicates pending requests and provider event identities',()=>fixture(async({store,sent,answer})=>{
  await Promise.all([store.refresh(range,[]),store.refresh(range,[])]);
  expect(sent).toHaveLength(1);
  answer(store.snapshot().operations[0].id,reply([timed(),timed()]));
  expect(store.snapshot().events).toHaveLength(1);
 }));
 it('keeps accounts and calendars distinct',()=>fixture(async({store,answer})=>{
  const other={...source,accountId:'second-account'};
  await store.refresh(range,[]);
  answer(store.snapshot().operations[0].id,{...reply([]),sources:[source,other],
   coverage:[source,other].map(item=>({accountId:item.accountId,calendarId:item.id,complete:true})),
   events:[timed(),{...timed(),accountId:other.accountId}]});
  expect(store.snapshot().events).toHaveLength(2);
 }));
 it('merges partial results and deletes missing remote events only for complete coverage',()=>fixture(async({store,answer})=>{
  const local=draft();await store.create(local);
  await store.refresh(range,[]);answer(store.snapshot().operations.at(-1)!.id,reply([timed()]));
  await store.refresh(range,[]);answer(store.snapshot().operations.at(-1)!.id,reply([],false));
  expect(store.snapshot().events).toHaveLength(2);
  await store.refresh(range,[]);answer(store.snapshot().operations.at(-1)!.id,reply([],true));
  expect(store.snapshot().events.map(event=>event.id)).toEqual([local.id]);
 }));
 it('keeps newer-month coverage when an older response arrives later',()=>fixture(async({store,answer})=>{
  const december={...range,start:'2026-12-01',end:'2027-01-01'};
  await store.refresh(range,[]);const old=store.snapshot().operations.at(-1)!.id;
  await store.refresh(december,[]);const recent=store.snapshot().operations.at(-1)!.id;
  answer(recent,reply([],true,december));answer(old,reply([timed()]));
  expect(store.snapshot().coverage.map(item=>item.range.start).sort()).toEqual(['2026-11-01','2026-12-01']);
 }));
 it('imports a delayed calendar result while its original request is still current',()=>fixture(async({store,answer})=>{
  await store.refresh(range,[]);
  const query=store.snapshot().operations[0];
  const clock=vi.spyOn(Date,'now').mockReturnValue(query.at+120001);
  try{
   expect(store.snapshot().operations[0].status).toBe('error');
   expect(store.waiting).toBe(true);
   answer(query.id,reply([timed()]));
   expect(store.snapshot().events).toEqual([timed()]);
   expect(store.waiting).toBe(false);
  }finally{clock.mockRestore();}
 }));
 it('ignores a delayed calendar result after an explicit retry superseded it',()=>fixture(async({store,answer})=>{
  await store.refresh(range,[]);
  const query=store.snapshot().operations[0];
  const clock=vi.spyOn(Date,'now').mockReturnValue(query.at+120001);
  try{
   store.snapshot();
   await store.refresh(range,[]);
   answer(query.id,reply([timed()]));
   expect(store.snapshot().events).toEqual([]);
   expect(store.snapshot().operations).toHaveLength(1);
  }finally{clock.mockRestore();}
 }));
 it('keeps the cached coverage of calendars excluded from a selective refresh',()=>fixture(async({store,answer})=>{
  const other={...source,id:'second-calendar'};
  await store.refresh(range,[]);
  answer(store.snapshot().operations[0].id,{...reply([]),sources:[source,other],
   coverage:[source,other].map(item=>({accountId:item.accountId,calendarId:item.id,complete:true}))});
  await store.refresh(range,[sourceKey(source)]);
  answer(store.snapshot().operations[0].id,reply([],false));
  expect(store.snapshot().coverage).toHaveLength(2);
  expect(store.snapshot().coverage.find(item=>item.source===sourceKey(other))?.complete).toBe(true);
  expect(store.snapshot().coverage.find(item=>item.source===sourceKey(source))?.complete).toBe(false);
 }));
 it('allows an explicit local copy of an unconfirmed remote creation without resending it',()=>fixture(async({store,answer,sent})=>{
  await store.refresh(range,[]);answer(store.snapshot().operations[0].id,reply([]));
  const input={...draft(),destination:sourceKey(source)};
  await store.create(input);
  const count=sent.length;
  const saved=await store.create({...input,destination:'local'});
  expect('event' in saved&&saved.event?.accountId).toBe('zen-local');
  expect(sent).toHaveLength(count);
  expect(store.snapshot().operations.some(item=>item.type==='created')).toBe(true);
 }));
 it('does not trust ordinary text or an invalid response and preserves the previous copy',()=>fixture(async({store,answer})=>{
  await store.refresh(range,[]);answer(store.snapshot().operations[0].id,reply([timed()]));
  await store.refresh(range,[]);const id=store.snapshot().operations.at(-1)!.id;
  store.observe('fixture-thread','fixture-folder','No tienes eventos.');
  expect(store.snapshot().operations.at(-1)!.status).toBe('waiting');
  answer(id,{...reply([]),events:[{title:'Invalid'}]});
  expect(store.snapshot().events).toHaveLength(1);expect(store.snapshot().operations.at(-1)!.status).toBe('error');
  await store.refresh(range,[]);
  expect(store.snapshot().operations.every(item=>item.status==='waiting')).toBe(true);
  answer(store.snapshot().operations.at(-1)!.id,reply([timed()]));
  expect(store.snapshot().operations).toHaveLength(0);
 }));
 it('requires a writable source and a real confirmed event before completing remote creation',()=>fixture(async({store,answer,sent})=>{
  await store.refresh(range,[]);answer(store.snapshot().operations[0].id,reply([]));
  const input={...draft(),destination:sourceKey(source)};
  const result=await store.create(input),operation='operation' in result?result.operation:undefined;
  expect(operation?.status).toBe('waiting');expect(store.snapshot().events).toHaveLength(0);
  await store.create(input);expect(sent).toHaveLength(2);
  answer(operation!.id,{version:1,type:'created',event:{...timed('provider-id'),title:input.title}});
  expect(store.snapshot().confirmations[0].draftId).toBe(input.id);
  const retry=await store.create(input);
  expect('event' in retry&&retry.event?.id).toBe('provider-id');expect(sent).toHaveLength(2);
 }));
 it('persists uncertainty across restarts so a retry cannot create another remote event',()=>fixture(async({store,answer,path,deps,sent})=>{
  await store.refresh(range,[]);answer(store.snapshot().operations[0].id,reply([]));
  const input={...draft(),destination:sourceKey(source)};
  await store.create(input);
  const result=await new CompanionCalendar(path,deps).create(input);
  expect('operation' in result&&result.operation?.status).toBe('uncertain');expect(sent).toHaveLength(2);
 }));
 it('retains requests while hidden but blocks new private actions',()=>fixture(async({store,policy,answer})=>{
  await store.refresh(range,[]);const id=store.snapshot().operations[0].id;
  policy.visible=false;
  await expect(store.create(draft())).rejects.toThrow('Abre Calendario');
  answer(id,reply([timed()]));
  expect(()=>store.snapshot()).toThrow();
  policy.visible=true;expect(store.snapshot().events).toHaveLength(1);
 }));
 it('exports local events and restores them without replacing remote cache',()=>fixture(async({store,answer})=>{
  await store.create(draft());
  await store.refresh(range,[]);answer(store.snapshot().operations[0].id,reply([timed()]));
  const backup=store.backupLocal();
  expect(backup.events.every(event=>event.accountId==='zen-local')).toBe(true);
  const undo=store.restoreLocal({version:1,events:[]});
  expect(store.snapshot().events).toEqual([timed()]);
  undo();expect(store.snapshot().events).toHaveLength(2);
 }));
});
