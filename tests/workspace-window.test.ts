import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {CompanionWorkspaceWindow, compactIslandSize, compactWorkspaceBounds, edgeBounds, edgePanelBounds, edgeShape, edgeWorkspaceMinimum, islandBounds, placeWorkspaceRail, railFromIsland, restoreWorkspace, workspaceLayout} from '../src/main/companion-workspace-window';
import {CAPSULE_POSITION, EDGE_ISLAND, ISLAND_LAYOUT, ISLAND_SIZE, ISLAND_STACKED} from '../src/shared/island';

const primary = {id: 1, workArea: {x: 0, y: 40, width: 1921, height: 1040}};
const secondary = {id: 2, workArea: {x: -1280, y: -100, width: 1280, height: 720}};

it('uses half the work area on either side, including negative monitor origins', () => {
  expect(workspaceLayout(primary.workArea, 'left')).toEqual({x: 0, y: 40, width: 961, height: 1040});
  expect(workspaceLayout(secondary.workArea, 'right')).toEqual({x: -640, y: -100, width: 640, height: 720});
  expect(workspaceLayout(secondary.workArea, 'free')).toEqual({x: -1120, y: -28, width: 960, height: 576});
});

it('restores on the saved monitor and uses a visible equivalent when that monitor disappears', () => {
  const saved = {displayId: 2, area: secondary.workArea, bounds: workspaceLayout(secondary.workArea, 'right'), maximized: false};
  expect(restoreWorkspace(saved, [primary, secondary], primary)).toEqual(saved.bounds);
  expect(restoreWorkspace(saved, [primary], primary)).toEqual(workspaceLayout(primary.workArea, 'right'));
  const reduced = {id: 2, workArea: {x: -700, y: 0, width: 700, height: 400}};
  expect(restoreWorkspace(saved, [primary, reduced], primary)).toEqual(workspaceLayout(reduced.workArea, 'right'));
  expect(restoreWorkspace({...saved, bounds: {x: -9000, y: 2000, width: 10, height: 40}}, [reduced], reduced))
    .toEqual({x: -700, y: 80, width: 320, height: 320});
});

it('projects the same position and width into the capsule at both rail heights', () => {
  const area=primary.workArea;
  const bounds=placeWorkspaceRail(area,{x:240,y:750,width:640,height:900});
  expect(bounds).toEqual({x:240,y:750,width:640,height:330});
  const saved={displayId:primary.id,area,bounds,maximized:false};
  expect(compactWorkspaceBounds(saved,true)).toEqual({x:240,y:750,width:640,height:102});
  expect(compactWorkspaceBounds({...saved,maximized:true},true)).toEqual({...area,height:68});
});

it('keeps the island attached to the saved edge and fits the expanded rail across monitor sizes', () => {
  for (const {id,workArea:area} of [primary,secondary,{id:3,workArea:{x:0,y:0,width:520,height:400}}]) {
    for (const side of ['left','right','free'] as const) {
      const bounds=workspaceLayout(area,side);
      const saved={displayId:id,area,bounds,maximized:false};
      const pill=islandBounds(saved);
      const rail=compactWorkspaceBounds(saved,true);
      expect(pill).toMatchObject({...ISLAND_SIZE,y:bounds.y});
      expect(islandBounds(saved,true)).toEqual({...pill,y:pill.y-EDGE_ISLAND.captionReserve,height:pill.height+EDGE_ISLAND.captionReserve});
      expect(rail.y+rail.height).toBeLessThanOrEqual(area.y+area.height);
      expect(rail.x+rail.width).toBeLessThanOrEqual(area.x+area.width);
      expect(railFromIsland(area,bounds,pill.x,pill.y)).toEqual(bounds);
      if(side==='left')expect(pill.x).toBe(area.x);
      if(side==='right')expect(pill.x+pill.width).toBe(area.x+area.width);
    }
  }
});

it('anchors the silhouette to the usable edge and mirrors the cutout',()=>{
  const area=secondary.workArea;
  const left={side:'left' as const,displayId:secondary.id,fraction:.5};
  const right={...left,side:'right' as const};
  const compact=edgeBounds(area,left,true,true),open=edgeBounds(area,right,false,true);
  expect(compact).toMatchObject({x:area.x,width:EDGE_ISLAND.width,height:EDGE_ISLAND.height+EDGE_ISLAND.captionReserve});
  expect(open.x+open.width).toBe(area.x+area.width);
  expect(Math.abs(compact.y+compact.height/2-open.y-open.height/2)).toBeLessThanOrEqual(.5);
  for(const fraction of [0,1]){
    const panel=edgePanelBounds(area,{x:0,y:0,width:650,height:620},{...right,fraction});
    expect(panel.x+panel.width).toBe(area.x+area.width);
    expect(panel.y).toBeGreaterThanOrEqual(area.y);
    expect(panel.y+panel.height).toBeLessThanOrEqual(area.y+area.height);
  }
  const {width,height}=EDGE_ISLAND;
  const leftRows=edgeShape(width,height,'left'),rightRows=edgeShape(width,height,'right');
  expect(leftRows[0].width).toBe(1);
  expect(leftRows.slice(ISLAND_LAYOUT.shoulder,height-ISLAND_LAYOUT.shoulder).every(row=>row.width===width)).toBe(true);
  expect(leftRows.map(row=>({...row,x:width-row.width-row.x}))).toEqual(rightRows);
  expect(edgeWorkspaceMinimum(area,'right').height).toBe(EDGE_ISLAND.railHeight+EDGE_ISLAND.captionReserve);
});

it('centers the upper dock on a secondary monitor and keeps its cutouts outside the interactive region',()=>{
  const area=secondary.workArea,dock={side:'top' as const,displayId:secondary.id,fraction:.5};
  const compact=edgeBounds(area,dock,true,true),open=edgeBounds(area,dock,false,true,700);
  expect(Math.abs(compact.x+compact.width/2-area.x-area.width/2)).toBeLessThanOrEqual(.5);
  expect(Math.abs(open.x+open.width/2-compact.x-compact.width/2)).toBeLessThanOrEqual(.5);
  expect(open.y+EDGE_ISLAND.captionReserve).toBe(area.y);
  expect(edgeBounds(area,dock,false,true,CAPSULE_POSITION.narrowAt).height).toBe(CAPSULE_POSITION.stackedHeight+EDGE_ISLAND.captionReserve);
  expect(edgePanelBounds(area,open,dock).y).toBe(area.y);
  const {width,height}=ISLAND_SIZE;
  const shape=edgeShape(width,height,'top');
  const includes=(x:number,y:number)=>shape.some(rect=>x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height);
  expect(includes(0,0)&&includes(width-1,0)&&includes(Math.floor(width/2),height-1)).toBe(true);
  expect(includes(0,height-1)||includes(width-1,height-1)).toBe(false);
});

it('makes room for both control groups when the compact island cannot fit in one line',()=>{
  const area={x:32,y:20,width:390,height:365};
  expect(compactIslandSize(area)).toEqual({stacked:true,width:ISLAND_STACKED.length,height:ISLAND_STACKED.cross});
  expect(compactIslandSize(area,true)).toEqual({stacked:true,width:ISLAND_STACKED.cross,height:ISLAND_STACKED.length});
  const top={side:'top' as const,displayId:1,fraction:.5};
  const upper=edgeBounds(area,top,true,true);
  expect(upper).toMatchObject({y:area.y-EDGE_ISLAND.captionReserve,width:ISLAND_STACKED.length,height:ISLAND_STACKED.cross+EDGE_ISLAND.captionReserve});
  const right=edgeBounds(area,{...top,side:'right'},true,true);
  expect(right.x+right.width).toBe(area.x+area.width);
  expect(right.height).toBe(ISLAND_STACKED.length+EDGE_ISLAND.captionReserve);
  const bounds=workspaceLayout(area,'right');
  const saved={displayId:1,area,bounds,maximized:false};
  const floating=islandBounds(saved);
  expect(railFromIsland(area,bounds,floating.x,floating.y)).toEqual(bounds);
});

it('preserves legacy floating geometry separately when the selected location is docked',()=>{
  const root=mkdtempSync(join(tmpdir(),'zen-workspace-'));
  const file=join(root,'window.json');
  const floating={displayId:secondary.id,area:secondary.workArea,bounds:workspaceLayout(secondary.workArea,'free'),maximized:false};
  try {
    writeFileSync(file,JSON.stringify({version:1,mode:'capsule',preferences:{islandMode:'floating',side:'right'},current:floating}));
    const window=new CompanionWorkspaceWindow(file);
    expect(window.floating).toEqual(floating);
    const edgeDock={side:'top' as const,displayId:primary.id,fraction:.5};
    const current={displayId:primary.id,area:primary.workArea,bounds:edgePanelBounds(primary.workArea,floating.bounds,edgeDock),maximized:false};
    expect(window.save({current,edgeDock,floating:window.floating,preferences:{...window.preferences,location:'top'}})).toBe(true);
    const restored=new CompanionWorkspaceWindow(file);
    expect(restored).toMatchObject({current,edgeDock,floating,preferences:{location:'top',side:'right'}});
    expect(restoreWorkspace(restored.floating!,[primary],primary)).toEqual(workspaceLayout(primary.workArea,'free'));
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('starts a fresh profile in the capsule and persists the shared geometry and launch preference', () => {
  const root = mkdtempSync(join(tmpdir(), 'zen-workspace-'));
  const file = join(root, 'window.json');
  try {
    const window = new CompanionWorkspaceWindow(file);
    expect(window.startupMode).toBe('capsule');
    const current = {displayId: 1, area: primary.workArea, bounds: workspaceLayout(primary.workArea, 'left'), maximized: true};
    const previous = {...current, maximized: false, bounds: workspaceLayout(primary.workArea, 'free')};
    expect(window.save({mode:'workspace',current, previous, preferences: {side: 'right', restoreOnLaunch: true}})).toBe(true);
    const restored = new CompanionWorkspaceWindow(file);
    expect(restored).toMatchObject({startupMode: 'workspace', current, previous, preferences: {side: 'right', restoreOnLaunch: true}});
    expect(restored.save({preferences: {side: 'right', restoreOnLaunch: false}})).toBe(true);
    expect(new CompanionWorkspaceWindow(file)).toMatchObject({startupMode: 'capsule', current, previous});
    writeFileSync(file, 'invalid');
    expect(new CompanionWorkspaceWindow(file)).toMatchObject({startupMode: 'capsule', current: undefined});
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
