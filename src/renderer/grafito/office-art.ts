import type {OfficinaActor} from '../../shared/companion-officina';
import type {OfficinaDesign} from '../../shared/officina-design';

const originals=import.meta.glob<string>('../assets/grafito/*.webp',{eager:true,import:'default',query:'?url'});
const panoramas=import.meta.glob<string>('../assets/officina-wide/*.webp',{eager:true,import:'default',query:'?url'});
const finishes=import.meta.glob<string>('../assets/officina-plans/*/*.webp',{eager:true,import:'default',query:'?url'});

// All eight plates in a finish are registered to the original Grafito camera.
export function officeArt(design:OfficinaDesign,view:OfficinaActor|'plan'|'panorama') {
  if(view==='panorama') return panoramas['../assets/officina-wide/'+design+'.webp'];
  return design==='graphite' ? originals['../assets/grafito/'+view+'.webp'] :
    finishes['../assets/officina-plans/'+design+'/'+view+'.webp'];
}
