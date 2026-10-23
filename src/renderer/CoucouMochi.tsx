import React from 'react';
import type {BotStateName} from '../coucou/core/layout';
import type {OutfitSelection} from '../coucou/mochi/wardrobe';
/** Compatibility for inactive historical screens. No character or cursor tracking. */
export function CoucouMochi(_props:{state:BotStateName;reduced:boolean;sound:boolean;outfit:OutfitSelection;receiving:boolean;soundStates?:boolean}){
 return <span className="zen-mark" role="img" aria-label="ZEN">Z</span>;
}
