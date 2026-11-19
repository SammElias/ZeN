import type {Area} from '../shared/overlay-position';
import type {IslandSide} from '../shared/island';
import {capsuleShape} from './overlay';
import {edgeShape} from './companion-workspace-window';
import {mergeShape} from './companion-placement';

export type CapsuleLayout={bounds:Area;capsule:Area;panel?:Area};
const clamp=(value:number,start:number,end:number)=>Math.max(start,Math.min(value,end));

/** Join the fixed capsule and its panel without filling the transparent space between them. */
export function capsuleLayout(area:Area,anchor:Area,desired:Area,side:IslandSide|undefined,open:boolean,reserve:number):CapsuleLayout {
 const capsule={...anchor,y:anchor.y+reserve,height:anchor.height-reserve};
 if(!open)return {bounds:anchor,capsule:{x:0,y:reserve,width:capsule.width,height:capsule.height}};
 const vertical=side==='left'||side==='right';
 const width=Math.min(area.width-(vertical?capsule.width:0),Math.max(320,desired.width-(vertical?capsule.width:0)));
 const available=area.y+area.height-capsule.y-capsule.height;
 const above=!side&&available<Math.min(320,capsule.y-area.y);
 const height=Math.max(1,Math.min(vertical?area.height:above?capsule.y-area.y:available,Math.max(320,desired.height-(vertical?0:capsule.height))));
 const panel:Area={
  width,height,
  x:vertical?(side==='left'?capsule.x+capsule.width:capsule.x-width):
   clamp(Math.round(capsule.x+(capsule.width-width)/2),area.x,area.x+area.width-width),
  y:vertical?clamp(Math.round(capsule.y+(capsule.height-height)/2),area.y,area.y+area.height-height):
   above?capsule.y-height:capsule.y+capsule.height,
 };
 const x=Math.min(capsule.x,panel.x),y=Math.min(anchor.y,panel.y);
 const bounds={x,y,width:Math.max(capsule.x+capsule.width,panel.x+panel.width)-x,
  height:Math.max(capsule.y+capsule.height,panel.y+panel.height)-y};
 const local=(rect:Area)=>({...rect,x:rect.x-x,y:rect.y-y});
 return {bounds,capsule:local(capsule),panel:local(panel)};
}

export function capsuleLayoutShape(layout:CapsuleLayout,side:IslandSide|undefined):Area[] {
 const translate=(rect:Area,rows:Area[])=>rows.map(row=>({...row,x:row.x+rect.x,y:row.y+rect.y}));
 const {capsule,panel}=layout;
 const shell=side?edgeShape(capsule.width,capsule.height,side,0,false,true):capsuleShape(capsule);
 return mergeShape([...translate(capsule,shell),...(panel?translate(panel,capsuleShape(panel)):[])]);
}

/** Shrink the native panel toward the adjacent capsule while leaving the viewport in place. */
export function retractCapsulePanel(layout:CapsuleLayout,side:IslandSide|undefined,progress:number):CapsuleLayout {
 const {panel,capsule}=layout;
 if(!panel||progress<=0)return layout;
 if(progress>=1)return {...layout,panel:undefined};
 if(side==='left'||side==='right'){
  const width=Math.max(1,Math.round(panel.width*(1-progress)));
  return {...layout,panel:{...panel,width,x:side==='right'?panel.x+panel.width-width:panel.x}};
 }
 const height=Math.max(1,Math.round(panel.height*(1-progress)));
 return {...layout,panel:{...panel,height,y:panel.y<capsule.y?panel.y+panel.height-height:panel.y}};
}

/** Native resize and Snap keep the capsule small while changing the available panel space. */
export function resizeCapsuleLayout(layout:CapsuleLayout,bounds:Area,side:IslandSide|undefined):CapsuleLayout {
 if(!layout.panel)return layout;
 const capsule={...layout.capsule,
  x:clamp(layout.bounds.x+layout.capsule.x-bounds.x,0,Math.max(0,bounds.width-layout.capsule.width)),
  y:clamp(layout.bounds.y+layout.capsule.y-bounds.y,0,Math.max(0,bounds.height-layout.capsule.height)),
 };
 if(side==='left')capsule.x=0;
 if(side==='right')capsule.x=bounds.width-capsule.width;
 const vertical=side==='left'||side==='right';
 const above=!side&&layout.panel.y<layout.capsule.y;
 const panel=vertical
  ?{x:side==='left'?capsule.width:0,y:0,width:bounds.width-capsule.width,height:bounds.height}
  :{x:0,y:above?0:capsule.y+capsule.height,width:bounds.width,height:above?capsule.y:bounds.height-capsule.y-capsule.height};
 return {bounds,capsule,panel};
}
