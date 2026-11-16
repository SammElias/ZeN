import {expect,it} from 'vitest';
import {AppearanceOptions} from '../src/shared/companion-appearance';
import {defaultNeon, neonPaletteIds, neonSpeeds, neonVisual} from '../src/shared/companion-neon';
import {EDGE_ISLAND, ISLAND_SIZE} from '../src/shared/island';
import {measureContour, neonContour} from '../src/renderer/neon-contour';
import {edgeShape} from '../src/main/companion-workspace-window';

it('loads old appearance without requiring a neon field and validates new settings',()=>{
  expect(AppearanceOptions.parse({theme:'dark'}).neon).toBeUndefined();
  expect(AppearanceOptions.parse({neon:{}}).neon).toEqual(defaultNeon);
  expect(AppearanceOptions.parse({neon:{palette:'jade',extension:0,animated:false}}).neon).toMatchObject({palette:'jade',extension:0,animated:false});
  for(const neon of [{palette:'auto'},{intensity:101},{extension:-1},{speed:'instant'}])expect(AppearanceOptions.safeParse({neon}).success).toBe(false);
  expect(neonPaletteIds).toHaveLength(4);
  expect(neonSpeeds.normal.duration).toBe(6000);
});

it('extends both tips within the existing Win32 contour and mirrors the lateral line',()=>{
  const {width,height}=EDGE_ISLAND;
  for(const side of ['left','right','top'] as const){
    const w=side==='top'?ISLAND_SIZE.width:width,h=side==='top'?ISLAND_SIZE.height:height;
    const axis=side==='top'?'x':'y';
    const shape={side,compact:true,radius:0};
    const line=neonContour(w,h,shape,neonVisual.maximumExtension);
    const plain=neonContour(w,h,shape,0);
    const trim=plain[0][axis]-line[0][axis];
    expect(trim).toBeGreaterThanOrEqual(12);
    expect(trim).toBeLessThanOrEqual(18);
    expect(line.at(-1)![axis]-plain.at(-1)![axis]).toBeCloseTo(trim);
    const region=edgeShape(w,h,side);
    for(const point of line){
      expect(region.some(({x,y,width,height})=>point.x>=x-1&&point.y>=y-1&&point.x<=x+width+1&&point.y<=y+height+1)).toBe(true);
    }
  }
  const left=neonContour(width,height,{side:'left',compact:true,radius:0},16);
  const right=neonContour(width,height,{side:'right',compact:true,radius:0},16);
  expect(left.map(({x,y})=>({x:width-x,y}))).toEqual(right);
});

it('closes the floating contour and measures one traversal including the rounded corners',()=>{
  const shape={radius:999};
  const points=neonContour(439,50,shape,16);
  expect(neonContour(439,50,shape,0)).toEqual(points);
  const track=measureContour(points,true);
  expect(track.at(-1)).toMatchObject(points[0]);
  expect(track.at(-1)!.distance).toBeGreaterThan(900);
  expect(track.at(-1)!.distance).toBeLessThan(2*(439+50));
});
