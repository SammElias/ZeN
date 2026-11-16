export const CAPSULE_WIDTH = 820;
export const CAPSULE_HEIGHT = 68;
export const CHAT_WIDTH = 640;
const button=30,gap=3,count=4;
export const CAPSULE_POSITION={button,gap,span:count*button+(count-1)*gap,narrowAt:520,stackedHeight:92} as const;
export const ISLAND_LAYOUT={emblem:34,grip:16,lock:26,gap:8,separator:4,shoulder:26,crossPadding:10} as const;
const length=ISLAND_LAYOUT.shoulder*2+ISLAND_LAYOUT.emblem+CAPSULE_POSITION.span+ISLAND_LAYOUT.lock+ISLAND_LAYOUT.grip+ISLAND_LAYOUT.gap*3+ISLAND_LAYOUT.separator;
export const ISLAND_SIZE={width:length,height:CAPSULE_POSITION.button+ISLAND_LAYOUT.crossPadding*2} as const;
export const EDGE_ISLAND={width:CAPSULE_POSITION.button+18,height:length,
 railWidth:Math.max(160,CAPSULE_POSITION.span+22),railHeight:438+CAPSULE_POSITION.button+10,captionReserve:34} as const;
export const capsuleContentHeight=(width:number)=>width<=CAPSULE_POSITION.narrowAt?CAPSULE_POSITION.stackedHeight:CAPSULE_HEIGHT;
export type IslandSide = 'top'|'left'|'right';
export const ISLAND_BLUR_MS = 260;
export const ISLAND_FINISH_MS = 9000;
