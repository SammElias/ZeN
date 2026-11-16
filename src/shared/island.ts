import {sectionPages} from './companion-navigation';

export const CAPSULE_WIDTH = 820;
export const CAPSULE_HEIGHT = 68;
export const CHAT_WIDTH = 640;
const button=30,gap=3,count=4;
export const CAPSULE_POSITION={button,gap,span:count*button+(count-1)*gap,narrowAt:520,stackedHeight:92} as const;
export const ISLAND_LAYOUT={emblem:34,grip:16,lock:26,gap:5,separator:4,shoulder:22,crossPadding:10} as const;
const navigation=ISLAND_LAYOUT.emblem+sectionPages.length*button+(sectionPages.length-1)*gap+ISLAND_LAYOUT.separator+ISLAND_LAYOUT.gap;
const controls=CAPSULE_POSITION.span+ISLAND_LAYOUT.lock+ISLAND_LAYOUT.grip+ISLAND_LAYOUT.gap*2;
const length=navigation+controls+ISLAND_LAYOUT.separator+ISLAND_LAYOUT.gap+ISLAND_LAYOUT.shoulder*2;
export const ISLAND_SIZE={width:length,height:CAPSULE_POSITION.button+ISLAND_LAYOUT.crossPadding*2} as const;
export const ISLAND_STACKED={length:Math.max(navigation,controls)+ISLAND_LAYOUT.shoulder*2,
 cross:ISLAND_LAYOUT.emblem+button+ISLAND_LAYOUT.gap+ISLAND_LAYOUT.crossPadding*2} as const;
export const EDGE_ISLAND={width:CAPSULE_POSITION.button+18,height:length,
 railWidth:Math.max(160,CAPSULE_POSITION.span+22),railHeight:438+CAPSULE_POSITION.button+10,captionReserve:34} as const;
export const capsuleContentHeight=(width:number)=>width<=CAPSULE_POSITION.narrowAt?CAPSULE_POSITION.stackedHeight:CAPSULE_HEIGHT;
export type IslandSide = 'top'|'left'|'right';
export const edgeShoulder=(length:number,compact:boolean)=>Math.max(1,Math.min(Math.round(length*.26),compact?ISLAND_LAYOUT.shoulder:34));
export function edgeContourDepth(offset:number,length:number,shoulder:number) {
  const t=Math.max(0,Math.min(1,Math.min(offset,length-offset)/shoulder));
  return t*t*(3-2*t);
}
export const ISLAND_BLUR_MS = 260;
export const ISLAND_FINISH_MS = 9000;
