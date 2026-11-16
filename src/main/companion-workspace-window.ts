import {readFileSync, renameSync, writeFileSync} from 'node:fs';
import {z} from 'zod';
import type {Area} from '../shared/overlay-position';
import {capsuleContentHeight,edgeContourDepth,edgeShoulder,EDGE_ISLAND,ISLAND_SIZE,ISLAND_STACKED,type IslandSide} from '../shared/island';
import {WorkspaceLayoutPreferences} from '../shared/workspace-layout';
import {mergeShape} from './companion-placement';

export const workspaceMinimum = {width: 320, height: 320};
export const workspaceCaptionHeight = EDGE_ISLAND.captionReserve;
const minimumPanelWidth=428;
const preferredPanelWidth=498;
type WorkDisplay = {id: number; workArea: Area};

const rect = z.object({
  x: z.number().int(), y: z.number().int(),
  width: z.number().int().min(1).max(100000), height: z.number().int().min(1).max(100000),
}).strict();
const geometry = z.object({
  bounds: rect, displayId: z.number().int(), area: rect, maximized: z.boolean(),
}).strict();
export type WorkspaceGeometry = z.infer<typeof geometry>;
const edgeDock = z.object({
  side:z.enum(['top','left','right']),displayId:z.number().int(),fraction:z.number().min(0).max(1),
}).strict();
export type EdgeDock = z.infer<typeof edgeDock>;

const stateSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['capsule', 'workspace']),
  preferences: WorkspaceLayoutPreferences,
  current: geometry.optional(),
  previous: geometry.optional(),
  floating: geometry.optional(),
  edgeDock: edgeDock.optional(),
}).strict();

const clamp=(value:number,start:number,end:number)=>Math.max(start,Math.min(value,end));

export function compactIslandSize(area:Area,vertical=false) {
  const stacked=(vertical?area.height:area.width)<ISLAND_SIZE.width;
  const length=stacked?ISLAND_STACKED.length:ISLAND_SIZE.width;
  const cross=stacked?ISLAND_STACKED.cross:vertical?EDGE_ISLAND.width:ISLAND_SIZE.height;
  return {stacked,width:Math.min(area.width,vertical?cross:length),height:Math.min(area.height,vertical?length:cross)};
}

export function edgeBounds(area:Area,dock:EdgeDock,compact:boolean,nativeCaption:boolean,railWidth=area.width/2):Area {
  const compactSize=compactIslandSize(area,dock.side!=='top');
  if(dock.side==='top'){
    const width=compact?compactSize.width:Math.min(area.width,Math.max(320,Math.round(railWidth)));
    const height=compact?compactSize.height:Math.min(area.height,capsuleContentHeight(width));
    const reserve=nativeCaption?EDGE_ISLAND.captionReserve:0;
    return {width,height:height+reserve,x:clamp(Math.round(area.x+area.width*dock.fraction-width/2),area.x,area.x+area.width-width),y:area.y-reserve};
  }
  const width=compact?compactSize.width:Math.min(area.width,EDGE_ISLAND.railWidth);
  const height=compact?compactSize.height:Math.min(area.height,EDGE_ISLAND.railHeight);
  const reserve=nativeCaption?EDGE_ISLAND.captionReserve:0;
  return {width,height:height+reserve,
    x:dock.side==='left'?area.x:area.x+area.width-width,
    y:clamp(Math.round(area.y+area.height*dock.fraction-height/2),area.y,area.y+area.height-height)-reserve};
}

export function edgePanelBounds(area:Area,panel:Area,dock:EdgeDock):Area {
  const width=Math.min(area.width,Math.max(EDGE_ISLAND.railWidth+preferredPanelWidth,panel.width));
  const height=Math.min(area.height,Math.max(620,panel.height));
  if(dock.side==='top')return {width,height,x:clamp(Math.round(area.x+area.width*dock.fraction-width/2),area.x,area.x+area.width-width),y:area.y};
  return {width,height,x:dock.side==='left'?area.x:area.x+area.width-width,
    y:clamp(Math.round(area.y+area.height*dock.fraction-height/2),area.y,area.y+area.height-height)};
}

export function edgeRailTop(bounds:Area,area:Area,dock:EdgeDock):number {
  const height=Math.min(EDGE_ISLAND.railHeight,Math.max(0,bounds.height-workspaceCaptionHeight));
  const relative=area.y+area.height*dock.fraction-bounds.y-height/2;
  return clamp(Math.round(relative),workspaceCaptionHeight,Math.max(workspaceCaptionHeight,bounds.height-height));
}

export function edgeWorkspaceMinimum(area:Area,side:IslandSide) {
  return {width:Math.min(area.width,EDGE_ISLAND.railWidth+minimumPanelWidth),
    height:Math.min(area.height,side==='top'?workspaceMinimum.height:EDGE_ISLAND.railHeight+workspaceCaptionHeight)};
}

export function edgeShape(width:number,height:number,side:IslandSide,railTop=0,panel=false,compact=side==='top'?width===ISLAND_SIZE.width:width===EDGE_ISLAND.width):Area[] {
  if(side==='top'){
    if(panel)return [];
    return mergeShape(edgeShape(height,width,'left',0,false,compact)).map(({x,y,width,height})=>({x:y,y:x,width:height,height:width}));
  }
  const railWidth=panel?Math.min(EDGE_ISLAND.railWidth,width):width;
  const railHeight=panel?Math.min(EDGE_ISLAND.railHeight,Math.max(0,height-workspaceCaptionHeight)):height;
  const shoulder=edgeShoulder(railHeight,compact);
  const panelRadius=14;
  return Array.from({length:height},(_,y)=>{
    const row=y-railTop;
    const bulge=edgeContourDepth(row+.5,railHeight,shoulder);
    const grown=row>=0&&row<railHeight?1+Math.round((railWidth-1)*bulge):0;
    if(!panel)return {x:side==='left'?0:width-grown,y,width:grown,height:1};
    const dy=Math.max(0,panelRadius-Math.min(y+.5,height-y-.5));
    const inset=Math.ceil(panelRadius-Math.sqrt(panelRadius**2-dy**2));
    if(side==='right'&&y<workspaceCaptionHeight)return {x:inset,y,width:width-2*inset,height:1};
    return {x:side==='left'?railWidth-grown:inset,y,width:width-railWidth+grown-inset,height:1};
  });
}

export function fitWorkspace(area: Area, bounds: Area): Area {
  const width = Math.min(area.width, Math.max(workspaceMinimum.width, bounds.width));
  const height = Math.min(area.height, Math.max(workspaceMinimum.height, bounds.height));
  return {
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
    width, height,
  };
}

export function capsuleRailHeight(width:number, nativeCaption:boolean):number {
  return capsuleContentHeight(width) + (nativeCaption && width <= 700 ? workspaceCaptionHeight : 0);
}

export function compactWorkspaceBounds(saved:WorkspaceGeometry, nativeCaption:boolean):Area {
  const visible = saved.maximized ? saved.area : saved.bounds;
  return {...visible, height: Math.min(saved.area.height, capsuleRailHeight(visible.width,nativeCaption))};
}

export function islandBounds(saved:WorkspaceGeometry,nativeCaption=false):Area {
  const {area}=saved;
  const rail=saved.maximized?area:saved.bounds;
  const {width,height}=compactIslandSize(area);
  const travel=area.width-rail.width;
  const ratio=travel>0?Math.max(0,Math.min(1,(rail.x-area.x)/travel)):.5;
  const reserve=nativeCaption?workspaceCaptionHeight:0;
  return {width,height:height+reserve,x:area.x+Math.round((area.width-width)*ratio),
    y:Math.max(area.y,Math.min(rail.y,area.y+area.height-height))-reserve};
}

export function railFromIsland(area:Area,panel:Area,x:number,y:number):Area {
  const travel=area.width-compactIslandSize(area).width;
  const ratio=travel>0?Math.max(0,Math.min(1,(x-area.x)/travel)):.5;
  const width=Math.min(panel.width,area.width);
  const spare=area.width-width;
  const sameAnchor=spare>0&&x-area.x===Math.round(travel*clamp((panel.x-area.x)/spare,0,1));
  return placeWorkspaceRail(area,{...panel,width,x:sameAnchor?panel.x:area.x+Math.round(spare*ratio),y});
}

/** Moving the rail explicitly may shorten the panel to keep it below the same origin. */
export function placeWorkspaceRail(area:Area, bounds:Area):Area {
  const size=fitWorkspace(area,bounds);
  const y=Math.max(area.y,Math.min(bounds.y,area.y+area.height-Math.min(workspaceMinimum.height,area.height)));
  return {...size,y,height:Math.min(size.height,area.y+area.height-y)};
}

export function workspaceLayout(area: Area, layout: 'left' | 'right' | 'free'): Area {
  const free = layout === 'free';
  const width = Math.min(area.width, Math.max(workspaceMinimum.width, Math.round(area.width * (free ? .75 : .5))));
  const height = free ? Math.min(area.height, Math.max(workspaceMinimum.height, Math.round(area.height * .8))) : area.height;
  const spare = area.width - width;
  return {
    x: area.x + (free ? Math.round(spare / 2) : layout === 'right' ? spare : 0),
    y: area.y + Math.round((area.height - height) / 2),
    width, height,
  };
}

export function restoreWorkspace(saved: WorkspaceGeometry, displays: WorkDisplay[], fallback: WorkDisplay): Area {
  const display = displays.find(candidate => candidate.id === saved.displayId) ?? fallback;
  const area = display.workArea;
  const {bounds, area: oldArea} = saved;
  if (oldArea.width === area.width && oldArea.height === area.height) {
    return fitWorkspace(area, {...bounds, x: area.x + bounds.x - oldArea.x, y: area.y + bounds.y - oldArea.y});
  }
  const scaledWidth = Math.round(bounds.width * area.width / oldArea.width);
  const scaledHeight = Math.round(bounds.height * area.height / oldArea.height);
  return fitWorkspace(area, {
    x: area.x + Math.round((bounds.x - oldArea.x) * area.width / oldArea.width),
    y: area.y + Math.round((bounds.y - oldArea.y) * area.height / oldArea.height),
    width: scaledWidth, height: scaledHeight,
  });
}

export class CompanionWorkspaceWindow {
  private state: z.infer<typeof stateSchema>;

  constructor(private file: string) {
    const defaults = stateSchema.parse({version: 1, mode: 'capsule', preferences: {}});
    try {
      this.state = stateSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      this.state = defaults;
    }
  }

  get startupMode() { return this.preferences.restoreOnLaunch ? this.state.mode : 'capsule'; }
  get preferences() { return this.state.preferences; }
  get current() { return this.state.current; }
  get previous() { return this.state.previous; }
  get floating() {
    const isFloating=(this.preferences.location??this.preferences.islandMode)==='floating';
    return this.state.floating??(isFloating?this.current:undefined);
  }
  get edgeDock() { return this.state.edgeDock; }

  save(change: Partial<Omit<z.infer<typeof stateSchema>, 'version'>>) {
    const next = stateSchema.parse({...this.state, ...change});
    if (JSON.stringify(this.state) === JSON.stringify(next)) return true;
    try {
      writeFileSync(this.file + '.tmp', JSON.stringify(next, null, 2));
      renameSync(this.file + '.tmp', this.file);
    } catch {
      return false;
    }
    this.state = next;
    return true;
  }
}
