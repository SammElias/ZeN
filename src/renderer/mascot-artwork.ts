import type {Wardrobe} from '../shared/mascot';

/** Original PNGs, framed at runtime without resampling or redrawing their clothing.
 * Pivots are fractions of the visible artwork, not an inferred 3D skeleton.
 * Small overlapping texture regions keep the local 2D movement connected. */
export const bodyArtwork:Record<Wardrobe,{
 src:string;width:number;height:number;box:[number,number,number,number];
 neck:number;hip:number;knee:number;split:number;
}>={
 signature:{src:'./mascot/body.png',width:1024,height:1536,box:[172,17,686,1503],neck:.385,hip:.68,knee:.865,split:.49},
 light:{src:'./mascot/outfits.png',width:1254,height:1254,box:[196,67,258,538],neck:.37,hip:.61,knee:.84,split:.53},
 all_black:{src:'./mascot/outfits.png',width:1254,height:1254,box:[783,70,292,538],neck:.35,hip:.65,knee:.84,split:.60},
 cozy:{src:'./mascot/outfits.png',width:1254,height:1254,box:[192,688,258,527],neck:.40,hip:.67,knee:.85,split:.51},
 layered:{src:'./mascot/outfits.png',width:1254,height:1254,box:[793,689,298,535],neck:.355,hip:.66,knee:.84,split:.55},
};
