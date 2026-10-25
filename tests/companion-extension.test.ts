import {describe,it,expect} from 'vitest';
import {capsuleExtensionBounds,mergeShape} from '../src/main/companion-placement';
import {capsuleShape} from '../src/main/overlay';
const area={x:0,y:0,width:1920,height:1040},base={x:700,y:0,width:760,height:80};
describe('one downward capsule',()=>{
 it('keeps the exact header location and width while adding content below',()=>{expect(capsuleExtensionBounds(area,base)).toEqual({...base,height:680});expect(base.height).toBe(80);});
 it('uses the available room below a side anchor before considering any move',()=>{expect(capsuleExtensionBounds(area,{...base,y:500})).toEqual({...base,y:500,height:540});});
 it('moves the entire capsule up only when the lower edge prevents a legible extension',()=>{expect(capsuleExtensionBounds(area,{...base,y:1000})).toEqual({...base,y:360,height:680});});
 it('handles negative origins and very small monitors without off-screen content',()=>{const a={x:-320,y:-200,width:320,height:300},b={x:-320,y:-200,width:320,height:80};expect(capsuleExtensionBounds(a,b)).toEqual({...b,height:300});});
 it('compresses the native region without changing a single scan line or mutating inputs',()=>{const rows=capsuleShape({width:637,height:680}),merged=mergeShape(rows);expect(merged.length).toBeLessThan(40);expect(rows).toHaveLength(680);for(const row of rows){const cover=merged.find(r=>row.y>=r.y&&row.y<r.y+r.height)!;expect(cover.x).toBe(row.x);expect(cover.width).toBe(row.width);}expect(merged.reduce((sum,r)=>sum+r.height,0)).toBe(680);});
});
