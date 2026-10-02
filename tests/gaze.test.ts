import {afterEach,describe,it,expect,vi} from 'vitest';
import {CursorGaze} from '../src/main/cursor-gaze';
import {gazeOffset,windowCursor} from '../src/shared/gaze';

afterEach(()=>vi.useRealTimers());
describe('local desktop gaze',()=>{
  it('follows desktop points outside the capsule and preserves directions on negative monitors',()=>{
    const box={x:9,y:7,width:26,height:26};
    const left=windowCursor({x:-1800,y:500},{x:-960,y:200});
    expect(gazeOffset(left,box).x).toBeLessThan(0);expect(gazeOffset(left,box).y).toBeGreaterThan(0);
    const right=gazeOffset({x:3000,y:-500},box);expect(right.x).toBeGreaterThan(0);expect(right.y).toBeLessThan(0);
    expect(right.x**2/36+right.y**2/16).toBeLessThanOrEqual(1);
    expect(windowCursor({x:200,y:300},{x:100,y:200},2)).toEqual({x:50,y:50});
  });
  it('centres at the robot and rejects invalid geometry',()=>{
    const box={x:0,y:0,width:96,height:96};
    expect(gazeOffset({x:48,y:48},box)).toEqual({x:0,y:0});
    for(const point of [null,{x:NaN,y:0},{x:Infinity,y:0}])expect(gazeOffset(point,box)).toEqual({x:0,y:0});
  });
  it('sends only changes, never reads while disabled and resumes with a fresh position',()=>{
    vi.useFakeTimers();let point={x:100,y:100};const read=vi.fn(()=>point),send=vi.fn(),gaze=new CursorGaze(read,send);
    expect(gaze.current()).toBeNull();vi.advanceTimersByTime(1000);expect(read).not.toHaveBeenCalled();
    gaze.enable(true);vi.advanceTimersByTime(1000);expect(send).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledTimes(21);
    point={x:-400,y:40};vi.advanceTimersByTime(50);expect(send).toHaveBeenLastCalledWith(point);
    gaze.enable(false);expect(send).toHaveBeenLastCalledWith(null);read.mockClear();vi.advanceTimersByTime(1000);expect(read).not.toHaveBeenCalled();
    gaze.enable(true);expect(send).toHaveBeenLastCalledWith(point);gaze.dispose();expect(vi.getTimerCount()).toBe(0);
  });
});
