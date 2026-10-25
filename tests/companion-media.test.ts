import {describe,it,expect,vi} from 'vitest';
import {CompanionMedia,CompanionMediaObserver} from '../src/main/companion-media';
import {MediaCommand,MediaNowPlaying,MediaSource} from '../src/shared/companion-media';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const track={session:id,source:'Spotify',browser:false,title:'Private title',artist:'Artist',album:'Album',artwork:null,playing:true,shuffle:null,repeat:null,positionMs:1000,durationMs:200000,controls:{play:true,pause:true,previous:true,next:true,shuffle:false,repeat:false}};
function fixture(){let allowed=true;const request=vi.fn(async(method:string)=>method==='list'?{sessions:[{id,name:'Spotify',browser:false}]}:method==='action'?{accepted:true}:structuredClone(track)),close=vi.fn(),factory=vi.fn(()=>({request,close})),media=new CompanionMedia(factory,()=>allowed);return{media,request,close,factory,block:()=>{allowed=false;}};}
async function selected(){const f=fixture();await f.media.list();await f.media.select(id);return f;}
describe('direct media session authority',()=>{
 it('discovers sources without reading titles or sending playback actions',async()=>{const f=fixture();expect(await f.media.list()).toHaveLength(1);expect(f.request.mock.calls).toEqual([['list',{}]]);});
 it('requires an explicitly listed source and exact session for every action',async()=>{const f=await selected();await expect(f.media.select(other)).rejects.toThrow();await expect(f.media.command({id:other,session:other,action:'pause'})).rejects.toThrow('destino');expect(f.request.mock.calls.filter(c=>c[0]==='action')).toHaveLength(0);});
 it('sends a bounded command only once and refuses unsupported controls',async()=>{const f=await selected();const c={id:other,session:id,action:'pause' as const};expect(await f.media.command(c)).toEqual({accepted:true});await expect(f.media.command(c)).rejects.toThrow('ya');await expect(f.media.command({...c,id,action:'shuffle',value:'on'})).rejects.toThrow('disponible');expect(f.request.mock.calls.filter(c=>c[0]==='action')).toHaveLength(1);});
 it('revokes selected sessions when leaving the panel and never retargets',async()=>{const f=await selected();f.media.close();await expect(f.media.read(id)).rejects.toThrow();await expect(f.media.command({id:other,session:id,action:'next'})).rejects.toThrow();expect(f.close).toHaveBeenCalledOnce();});
 it('blocks presentation before starting native work',async()=>{const f=fixture();f.block();await expect(f.media.list()).rejects.toThrow('Presentación');expect(f.factory).not.toHaveBeenCalled();});
 it('discards private metadata arriving after presentation or closure',async()=>{const f=await selected();let resolve!:(v:unknown)=>void;f.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}) as any);const read=f.media.read(id);await Promise.resolve();f.block();f.media.close();resolve(track);await expect(read).rejects.toThrow();});
 it('rejects a native response for a different session and clears old authority',async()=>{const f=await selected();f.request.mockResolvedValueOnce({...track,session:other} as any);await expect(f.media.read(id)).rejects.toThrow('fuente');await expect(f.media.command({id:other,session:id,action:'pause'})).rejects.toThrow('destino');});
 it('shares only the explicitly selected session across views and revokes cached reads under policy',async()=>{const f=fixture();expect(f.media.current()).toBe(null);await f.media.list();await f.media.select(id);const shown=f.media.current()!;shown.title='Changed in renderer';expect(f.media.current()!.title).toBe('Private title');f.block();expect(()=>f.media.current()).toThrow('Presentación');f.media.close();});
 it('does not retry a timed out playback effect',async()=>{const f=await selected();f.request.mockRejectedValueOnce(Error('timeout'));await expect(f.media.command({id:other,session:id,action:'next'})).rejects.toThrow('timeout');expect(f.request.mock.calls.filter(c=>c[0]==='action')).toHaveLength(1);expect(f.close).toHaveBeenCalled();});
 it('serializes read and command instead of racing native requests',async()=>{const f=await selected();let resolve!:(v:any)=>void;f.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const read=f.media.read(id);await Promise.resolve();const action=f.media.command({id:other,session:id,action:'pause'});expect(f.request.mock.calls.filter(c=>c[0]==='action')).toHaveLength(0);resolve(track);await read;await action;expect(f.request.mock.calls.at(-1)?.[0]).toBe('action');});
 it('rejects arbitrary commands, programs, URLs and mismatched values',()=>{for(const v of [{id,session:id,action:'shell',value:'cmd.exe'},{id,session:id,action:'pause',value:'on'},{id,session:id,action:'shuffle',value:'all'},{id,session:id,action:'repeat',value:'https://foreign.test'}])expect(MediaCommand.safeParse(v).success).toBe(false);});
});

const playing={source:'Video player',browser:false,title:'Published media title',artist:'Published artist',album:'',artwork:null,playing:true as const};
function observationFixture(){
 let allowed=true;
 const request=vi.fn(async()=>({track:structuredClone(playing)} as {track:unknown})),close=vi.fn(),factory=vi.fn(()=>({request,close}));
 const observer=new CompanionMediaObserver(factory,()=>allowed);
 return{observer,request,close,factory,block:()=>{allowed=false;},allow:()=>{allowed=true;}};
}
describe('automatic read-only Windows media observation',()=>{
 it('accepts any bounded Windows media publisher without a four-app allowlist',()=>{
  for(const name of ['VLC media player','Video player','SomePublisher.Player_123!App','Spotify','Google Chrome'])expect(MediaSource.safeParse(name).success).toBe(true);
  for(const name of ['', 'x'.repeat(121),'window\ncontent'])expect(MediaSource.safeParse(name).success).toBe(false);
 });
 it('reads only nowPlaying and exposes no automatic session or playback authority',async()=>{
  const f=observationFixture();expect(f.observer.current()).toBe(null);expect(await f.observer.read()).toEqual(playing);
  expect(f.request.mock.calls).toEqual([['nowPlaying']]);
  expect(f.observer.current()).not.toHaveProperty('session');expect(f.observer.current()).not.toHaveProperty('controls');
 });
 it('removes the old track immediately when no Windows session is playing',async()=>{
  const f=observationFixture();await f.observer.read();f.request.mockResolvedValueOnce({track:null});
  expect(await f.observer.read()).toBe(null);expect(f.observer.current()).toBe(null);
 });
 it('returns copies of observed metadata instead of mutable cached objects',async()=>{
  const f=observationFixture(),shown=(await f.observer.read())!;shown.title='Changed';expect(f.observer.current()!.title).toBe(playing.title);
  const cached=f.observer.current()!;cached.artist='Changed';expect(f.observer.current()!.artist).toBe(playing.artist);
 });
 it('never starts the helper while presentation, pause or header visibility forbid reading',async()=>{
  const f=observationFixture();f.block();await expect(f.observer.read()).rejects.toThrow('oculta');expect(f.factory).not.toHaveBeenCalled();
 });
 it('discards replies arriving after the header closes even if it becomes allowed again',async()=>{
  const f=observationFixture();let resolve!:(v:{track:unknown})=>void;
  f.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const pending=f.observer.read();
  f.block();f.observer.close();f.allow();resolve({track:playing});await expect(pending).rejects.toThrow('activa');expect(f.observer.current()).toBe(null);
 });
 it('also checks policy after native reads and discards private metadata without an explicit close',async()=>{
  const f=observationFixture();let resolve!:(v:{track:unknown})=>void;
  f.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const pending=f.observer.read();
  f.block();resolve({track:playing});await expect(pending).rejects.toThrow('oculta');expect(f.close).toHaveBeenCalledOnce();
  f.allow();expect(f.observer.current()).toBe(null);
 });
 it('coalesces simultaneous header reads into one native read',async()=>{
  const f=observationFixture();let resolve!:(v:{track:unknown})=>void;
  f.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const a=f.observer.read(),b=f.observer.read();
  expect(f.request).toHaveBeenCalledOnce();resolve({track:playing});expect(await a).toEqual(playing);expect(await b).toEqual(playing);
 });
 it('rejects stopped metadata and any response that includes a control token',async()=>{
  for(const bad of [{...playing,playing:false},{...playing,session:id},{...playing,controls:track.controls}]){
   expect(MediaNowPlaying.safeParse(bad).success).toBe(false);const f=observationFixture();f.request.mockResolvedValueOnce({track:bad});
   await expect(f.observer.read()).rejects.toThrow();expect(f.observer.current()).toBe(null);expect(f.close).toHaveBeenCalledOnce();
  }
 });
 it('cannot retarget or revoke a separate manually selected player while observing another app',async()=>{
  const manual=await selected(),f=observationFixture();await f.observer.read();f.observer.close();
  expect(manual.media.current()!.session).toBe(id);await manual.media.command({id:other,session:id,action:'pause'});
  expect(manual.request.mock.calls.at(-1)).toEqual(['action',{session:id,action:'pause'}]);expect(manual.close).not.toHaveBeenCalled();
 });
 it('closes failed observation without retrying within that read',async()=>{
  const f=observationFixture();f.request.mockRejectedValueOnce(Error('unavailable'));
  await expect(f.observer.read()).rejects.toThrow('unavailable');expect(f.request).toHaveBeenCalledOnce();expect(f.close).toHaveBeenCalledOnce();
 });
});
