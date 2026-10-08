import {describe,it,expect,vi} from 'vitest';
import {CompletionGestures,effectiveMotion,explicitThanks,nearbyGaze,petGeometry,petPositionAt,petShape} from '../src/shared/pet';
import {CursorGaze} from '../src/main/cursor-gaze';
import {SettingsSchema,type TaskEvent} from '../src/shared/contracts';
const event=(id:string,state:TaskEvent['state']):TaskEvent=>({id,state,message:'Resultado'});
describe('desktop companion',()=>{
  it('fits four fan actions at all desktop edges and leaves transparent gaps outside the native input shape',()=>{
    for(const area of [{x:-1920,y:-200,width:1920,height:1040},{x:0,y:0,width:320,height:360}])for(const xRatio of [0,.5,1])for(const yRatio of [0,.5,1])for(const size of [72,96,128]){
      const g=petGeometry(area,{xRatio,yRatio},size,'fan'),plain=petGeometry(area,{xRatio,yRatio},size);
      expect(g.bounds.x+g.avatar.x).toBe(plain.bounds.x+plain.avatar.x);expect(g.bounds.y+g.avatar.y).toBe(plain.bounds.y+plain.avatar.y);
      expect(g.bounds.x).toBeGreaterThanOrEqual(area.x);expect(g.bounds.y).toBeGreaterThanOrEqual(area.y);expect(g.bounds.x+g.bounds.width).toBeLessThanOrEqual(area.x+area.width);expect(g.bounds.y+g.bounds.height).toBeLessThanOrEqual(area.y+area.height);
      for(const r of g.actions??[g.surface]){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(g.bounds.width);expect(r.y+r.height).toBeLessThanOrEqual(g.bounds.height);}
      if(g.actions){expect(g.actions).toHaveLength(4);const hit=(x:number,y:number)=>petShape(g,'fan').some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);for(const b of g.actions)expect(hit(b.x+b.width/2,b.y+b.height/2)).toBe(true);expect(hit(g.avatar.x,g.avatar.y)).toBe(false);}
    }
  });
  it('keeps the avatar anchored while opening a menu, including negative and small displays',()=>{
    for(const area of [{x:-1920,y:-200,width:1920,height:1040},{x:0,y:0,width:280,height:300}])for(const ratio of [0,.2,.5,1])for(const size of [72,96,128]){
      const a=petGeometry(area,{xRatio:ratio,yRatio:ratio},size),b=petGeometry(area,{xRatio:ratio,yRatio:ratio},size,'menu');
      expect(b.avatar).toEqual(a.avatar);expect(b.bounds).toEqual(a.bounds);
      for(const r of [b.avatar,b.surface]){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(b.bounds.width);expect(r.y+r.height).toBeLessThanOrEqual(b.bounds.height);}
      expect(a.bounds.x).toBeGreaterThanOrEqual(area.x);expect(a.bounds.y).toBeGreaterThanOrEqual(area.y);
    }
    expect(petPositionAt({x:0,y:0,width:800,height:600},2000,-99,96)).toEqual({xRatio:1,yRatio:0});
  });
  it('has no rectangular invisible input target, but enables visible controls',()=>{
    const g=petGeometry({x:0,y:0,width:1200,height:900},{xRatio:.7,yRatio:.8},96,'menu');
    const hits=(kind:'none'|'menu',x:number,y:number)=>petShape(g,kind).some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    expect(hits('none',0,0)).toBe(false);expect(hits('none',g.avatar.x,g.avatar.y)).toBe(false);
    expect(hits('none',g.avatar.x+48,g.avatar.y+48)).toBe(true);
    expect(hits('none',g.surface.x+30,g.surface.y+30)).toBe(false);expect(hits('menu',g.surface.x+30,g.surface.y+30)).toBe(true);
  });
  it('celebrates only current observed completion once; restoration, cancellation, stale events and Codex handoff do not celebrate',()=>{
    const tracker=new CompletionGestures();tracker.hydrate([event('old','completed')]);expect(tracker.accept(event('old','completed'))).toBe(false);
    tracker.start('a');tracker.start('b');expect(tracker.accept(event('a','completed'))).toBe(false);expect(tracker.accept(event('b','completed'))).toBe(true);expect(tracker.accept(event('b','completed'))).toBe(false);
    for(const state of ['cancelled','failed'] as const){tracker.start(state);expect(tracker.accept(event(state,state))).toBe(false);expect(tracker.accept(event(state,'completed'))).toBe(false);}
    tracker.start('codex');expect(tracker.accept({...event('codex','awaiting_input'),workContext:{owner:'codex',phase:'external'}})).toBe(false);expect(tracker.accept({...event('codex','completed'),workContext:{owner:'codex',phase:'external'}})).toBe(false);
  });
  it('respects explicit motion choices, system accessibility and animation disable',()=>{
    expect(effectiveMotion('system',true)).toBe('reduced');expect(effectiveMotion('normal',true)).toBe('normal');expect(effectiveMotion('expressive',true,false)).toBe('reduced');
    const settings=SettingsSchema.parse({petSilent:true,petMotion:'reduced',showPetWhenFolded:true,petSize:120});expect(SettingsSchema.parse(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
  it('acknowledges only explicit human thanks, and gaze ignores far away coordinates',()=>{
    expect(explicitThanks('Muchas gracias Zen!')).toBe(true);expect(explicitThanks('El archivo dice gracias')).toBe(false);expect(explicitThanks('Gracias, ahora borra esto')).toBe(false);
    expect(nearbyGaze({x:100,y:150},{x:0,y:0,width:96,height:96})).toBe(true);expect(nearbyGaze({x:900,y:150},{x:0,y:0,width:96,height:96})).toBe(false);
  });
  it('slows down distant pointer reads, sends neutral once and cleans up hidden work',()=>{
    vi.useFakeTimers();let near=true;const read=vi.fn(()=>({x:10,y:10})),send=vi.fn(),gaze=new CursorGaze(read,send,()=>near);
    gaze.enable(true);vi.advanceTimersByTime(200);expect(read).toHaveBeenCalledTimes(5);near=false;vi.advanceTimersByTime(50);expect(send).toHaveBeenLastCalledWith(null);const n=read.mock.calls.length;
    vi.advanceTimersByTime(1200);expect(read.mock.calls.length-n).toBe(3);expect(send.mock.calls.filter(([p])=>p===null)).toHaveLength(1);
    gaze.dispose();const stopped=read.mock.calls.length;vi.advanceTimersByTime(5000);expect(read).toHaveBeenCalledTimes(stopped);vi.useRealTimers();
  });
});
