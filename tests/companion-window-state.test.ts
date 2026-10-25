import {describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CompanionWindowState,restoreWindow,type SavedWindow} from '../src/main/companion-window-state';
import {capsuleLauncherBounds} from '../src/main/companion-placement';
const a={x:-1920,y:0,width:1920,height:1040},b={x:0,y:0,width:1280,height:720},saved:SavedWindow={key:'workspace',displayId:1,area:a,bounds:{x:-1600,y:100,width:620,height:640},maximized:false};
describe('persistent common workspace geometry',()=>{
 it('reopens exactly where left on the same monitor',()=>{expect(restoreWindow(saved,[{id:1,workArea:a}],1).bounds).toEqual(saved.bounds);});
 it('keeps the local position when a monitor moves to another origin',()=>{expect(restoreWindow(saved,[{id:1,workArea:{...a,x:-2560,y:-200}}],1).bounds).toEqual({...saved.bounds,x:-2240,y:-100});});
 it('recovers onto an available monitor after unplugging the saved one',()=>{const r=restoreWindow(saved,[{id:2,workArea:b}],2);expect(r.displayId).toBe(2);expect(r.bounds.x).toBeGreaterThanOrEqual(0);expect(r.bounds.y+r.bounds.height).toBeLessThanOrEqual(720);});
 it('fits tiny work areas without leaving inaccessible edges',()=>{expect(restoreWindow(saved,[{id:2,workArea:{x:0,y:0,width:320,height:300}}],2).bounds).toEqual({x:0,y:0,width:320,height:300});});
 it('persists workspace and notices independently across store instances',()=>{const root=mkdtempSync(join(tmpdir(),'zen-window-'));try{const path=join(root,'state.json'),s=new CompanionWindowState(path);s.save(saved);s.save({...saved,key:'notices',bounds:{x:-900,y:40,width:400,height:500},maximized:true});const next=new CompanionWindowState(path);expect(next.get('workspace')).toEqual(saved);expect(next.get('notices')?.maximized).toBe(true);expect(readFileSync(path,'utf8')).not.toContain('gmail');}finally{rmSync(root,{recursive:true,force:true});}});
 it('ignores corrupt or unbounded stored rectangles',()=>{const root=mkdtempSync(join(tmpdir(),'zen-window-'));try{const path=join(root,'state.json');writeFileSync(path,JSON.stringify({version:1,windows:[{...saved,bounds:{...saved.bounds,width:-1}}]}));expect(new CompanionWindowState(path).get('workspace')).toBeUndefined();}finally{rmSync(root,{recursive:true,force:true});}});
});

describe('compact capsule integration launcher',()=>{
 it('grows to the right without changing height or moving the base',()=>{expect(capsuleLauncherBounds(b,{x:100,y:20,width:637,height:60})).toEqual({x:100,y:20,width:833,height:60});});
 it('clamps at the right edge without changing the saved capsule rectangle',()=>{const base={x:643,y:20,width:637,height:60};expect(capsuleLauncherBounds(b,base)).toEqual({x:447,y:20,width:833,height:60});expect(base.x).toBe(643);expect(base.width).toBe(637);});
 it('keeps all icons inside tiny and negative-origin monitors',()=>{expect(capsuleLauncherBounds({x:-320,y:-40,width:320,height:600},{x:-320,y:-40,width:320,height:60})).toEqual({x:-320,y:-40,width:320,height:60});});
});
