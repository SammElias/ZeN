import {describe,expect,it} from 'vitest';
import {noticeTone} from '../src/shared/notice-tone';
describe('original local notice tones',()=>{
 it('creates distinct bounded mono signals with silent edges and gaps',()=>{const rate=48000,finish=noticeTone('finish',rate),error=noticeTone('error',rate),permission=noticeTone('approval',rate);expect(finish.length).toBe(10560);expect(permission.length).toBe(15840);expect(finish).not.toEqual(error);expect(finish[0]).toBe(0);expect(finish.at(-1)).toBe(0);expect(finish.slice(3840,5280).every(v=>v===0)).toBe(true);for(const samples of [finish,error,permission]){expect(samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=.180001)).toBe(true);expect(samples.some(v=>Math.abs(v)>.1)).toBe(true);}});
 it('rejects invalid rates before allocating audio buffers',()=>{for(const rate of [0,NaN,Infinity,1e9,7999,44100.5])expect(()=>noticeTone('finish',rate)).toThrow();expect(noticeTone('finish',8000).length).toBe(1760);});
});
