import {boardCoordinateLimit, boardSize, type BoardClip, type BoardStroke} from '../shared/whiteboard';

export const originalBoard: BoardClip = {left:0,top:0,right:boardSize.width,bottom:boardSize.height};

export function limitBoardCoordinate(value: number) {
  return Math.max(-boardCoordinateLimit, Math.min(boardCoordinateLimit, value));
}

export function boardView(strokes: readonly BoardStroke[], width: number, height: number) {
  const centerX = boardSize.width/2, centerY = boardSize.height/2;
  let radiusX = centerX, radiusY = centerY;
  for (const stroke of strokes) {
    // The original paper already bounds legacy strokes. Erasures add no visible extent.
    if (stroke.tool!=='brush' || !stroke.clip) continue;
    const {left,top,right,bottom} = stroke.clip;
    const padding = stroke.width/2;
    for (const [x,y] of stroke.points) {
      radiusX = Math.max(radiusX, centerX-Math.max(left,x-padding), Math.min(right,x+padding)-centerX);
      radiusY = Math.max(radiusY, centerY-Math.max(top,y-padding), Math.min(bottom,y+padding)-centerY);
    }
  }
  const scale = Math.min(width/(2*radiusX),height/(2*radiusY));
  const halfWidth = width/(2*scale), halfHeight = height/(2*scale);
  return {
    scale,
    area: {left:centerX-halfWidth,top:centerY-halfHeight,right:centerX+halfWidth,bottom:centerY+halfHeight},
  };
}
