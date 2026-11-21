import {expect,it} from 'vitest';
import {boardView,originalBoard} from '../src/renderer/whiteboard-view';
import type {BoardStroke} from '../src/shared/whiteboard';

it('exposes the full tall or wide surface using the same scale on both axes',()=>{
  expect(boardView([],480,640)).toEqual({scale:.5,area:{left:0,top:-320,right:960,bottom:960}});
  expect(boardView([],960,320)).toEqual({scale:.5,area:{left:-480,top:0,right:1440,bottom:640}});
});

it('fits expanded edge marks when the panel changes shape without moving them in the same panel',()=>{
  const tall = boardView([],480,640);
  const strokes: BoardStroke[] = [{tool:'brush',width:12,color:'ink',points:[[100,-319],[100,959]],clip:tall.area}];
  expect(boardView(strokes,480,640)).toEqual(tall);
  const wide = boardView(strokes,960,320);
  expect(wide.scale).toBe(.25);
  expect(wide.area.top).toBeLessThan(-319);
  expect(wide.area.bottom).toBeGreaterThan(959);
});

it('ignores coordinates clipped by the old paper or the bounds of a saved gesture',()=>{
  const strokes: BoardStroke[] = [
    {tool:'brush',width:5,color:'blue',points:[[480,330],[480,960]]},
    {tool:'brush',width:5,color:'blue',points:[[100,100],[1800,1150]],clip:originalBoard},
    {tool:'eraser',points:[[2200,800]],clip:{left:-2000,top:-1000,right:2500,bottom:1800}},
  ];
  expect(boardView(strokes,480,640)).toEqual(boardView([],480,640));
});
