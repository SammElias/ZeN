import {expect,it} from 'vitest';
import {capsuleLayout,capsuleLayoutShape,resizeCapsuleLayout,retractCapsulePanel} from '../src/main/companion-capsule-layout';
import {edgeBounds,islandBounds} from '../src/main/companion-workspace-window';
import {CompanionWorkspaceWindow} from '../src/main/companion-workspace-window';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const area={x:-1920,y:30,width:1920,height:1000},desired={x:-1920,y:30,width:960,height:1000};
it('keeps the visible capsule anchored when any panel opens',()=>{
 for(const side of ['top','left','right'] as const){
  const anchor=edgeBounds(area,{side,displayId:1,fraction:.7},true,true);
  const closed=capsuleLayout(area,anchor,desired,side,false,34),open=capsuleLayout(area,anchor,desired,side,true,34);
  for(const key of ['width','height'] as const)expect(open.capsule[key]).toBe(closed.capsule[key]);
  expect(open.bounds.x+open.capsule.x).toBe(anchor.x);
  expect(open.bounds.y+open.capsule.y).toBe(anchor.y+34);
  expect(open.panel!.width).toBeGreaterThan(400);expect(open.bounds.width).toBeLessThanOrEqual(area.width);
 }
});
it('uses the available side in floating mode without covering transparent gaps',()=>{
 const anchor=islandBounds({displayId:1,area,bounds:{...desired,y:730,height:300},maximized:false},true);
 const layout=capsuleLayout(area,anchor,desired,undefined,true,34);
 expect(layout.panel!.y).toBeLessThan(layout.capsule.y);
 const region=capsuleLayoutShape(layout,undefined);
 const inside=(x:number,y:number)=>region.some(rect=>x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height);
 expect(inside(layout.capsule.x+1,layout.capsule.y+layout.capsule.height-1)).toBe(false);
 expect(inside(layout.capsule.x+layout.capsule.width/2,layout.capsule.y+20)).toBe(true);
});
it('retains capsule size when Windows resizes or snaps the panel',()=>{
 const anchor=edgeBounds(area,{side:'right',displayId:1,fraction:.5},true,true);
 const natural=capsuleLayout(area,anchor,desired,'right',true,34);
 const resized=resizeCapsuleLayout(natural,{...natural.bounds,width:700,height:800},'right');
 expect(resized.capsule.width).toBe(natural.capsule.width);expect(resized.capsule.height).toBe(natural.capsule.height);
 expect(resized.panel!.width+resized.capsule.width).toBe(700);expect(resized.panel!.height).toBe(800);
});
it('retracts the panel toward the capsule from each position while keeping the capsule fixed',()=>{
 const rightEdge=({x,width}:{x:number;width:number})=>x+width;
 const bottomEdge=({y,height}:{y:number;height:number})=>y+height;
 for(const side of ['left','right','top',undefined] as const){
  const anchor=side?edgeBounds(area,{side,displayId:1,fraction:.7},true,true):
   islandBounds({displayId:1,area,bounds:{...desired,y:730,height:300},maximized:false},true);
  const view=capsuleLayout(area,anchor,desired,side,true,34);
  const partial=retractCapsulePanel(view,side,.5),panel=view.panel!,part=partial.panel!;
  expect(partial.capsule).toEqual(view.capsule);
  expect(partial.bounds).toEqual(view.bounds);
  if(side==='left'||side==='right'){
   expect(part.width).toBe(Math.round(panel.width/2));
   expect(part.height).toBe(panel.height);
   expect(side==='left'?part.x:rightEdge(part)).toBe(side==='left'?panel.x:rightEdge(panel));
  }else{
   expect(part.height).toBe(Math.round(panel.height/2));
   expect(part.width).toBe(panel.width);
   expect(side==='top'?part.y:bottomEdge(part)).toBe(side==='top'?panel.y:bottomEdge(panel));
  }
  expect(retractCapsulePanel(view,side,1).panel).toBeUndefined();
 }
});
it('loads old open and closed presentations without resetting location or monitor',()=>{
 const root=mkdtempSync(join(tmpdir(),'zen-capsule-migrate-'));
 try{
  for(const mode of ['capsule','workspace'] as const){
   const path=join(root,mode+'.json'),edgeDock={side:'right',displayId:8,fraction:.75};
   writeFileSync(path,JSON.stringify({version:1,mode,preferences:{location:'right',restoreOnLaunch:true},edgeDock,
    current:{bounds:desired,displayId:8,area,maximized:false}}));
   const state=new CompanionWorkspaceWindow(path);
   expect(state.startupMode).toBe(mode);expect(state.edgeDock).toEqual(edgeDock);
   expect(state.current?.displayId).toBe(8);expect(state.page).toBeUndefined();
   state.save({page:'calendar'});
   expect(new CompanionWorkspaceWindow(path).page).toBe('calendar');
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
