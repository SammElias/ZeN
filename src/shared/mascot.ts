/** Local presentation data. Never included in provider instructions or task authority. */
export const tones=['neutral','smug','confident','sad_empathic','playful_cocky'] as const;
export type MascotTone=typeof tones[number];
export const toneLabels:Record<MascotTone,string>={neutral:'Neutral',smug:'Creído',confident:'Seguro',sad_empathic:'Triste',playful_cocky:'Xulito'};
export const wardrobes=['signature','light','all_black','cozy','layered'] as const;
export type Wardrobe=typeof wardrobes[number];
export const wardrobeLabels:Record<Wardrobe,string>={signature:'Signature',light:'Blanco oversize',all_black:'Total black',cozy:'Grafito',layered:'Urbano en capas'};
export const toneWardrobe:Record<MascotTone,Wardrobe>={neutral:'signature',smug:'light',confident:'all_black',sad_empathic:'cozy',playful_cocky:'layered'};
export type ToneMetadata={schemaVersion:1;value:MascotTone;intensity:number;source:'validated_metadata'|'local_rule'};
export type MessageAppearance={chatId:string;messageId:string;tone:ToneMetadata};
export const neutralTone=():ToneMetadata=>({schemaVersion:1,value:'neutral',intensity:.35,source:'local_rule'});
export function validateTone(input:unknown):ToneMetadata{
 if(!input||typeof input!=='object')return neutralTone();
 const v=input as Partial<ToneMetadata>;
 if(v.schemaVersion!==1||!tones.includes(v.value!)||!['validated_metadata','local_rule'].includes(v.source!))return neutralTone();
 return{schemaVersion:1,value:v.value!,source:v.source!,intensity:typeof v.intensity==='number'&&Number.isFinite(v.intensity)?Math.min(1,Math.max(0,v.intensity)):.35};
}
export function validateAppearance(input:unknown,chatId:string,messageId:string):MessageAppearance{
 const v=input as Partial<MessageAppearance>|undefined;
 return{chatId,messageId,tone:v?.chatId===chatId&&v.messageId===messageId?validateTone(v.tone):neutralTone()};
}
export type MascotActivity='idle'|'listening'|'thinking'|'speaking'|'executing'|'error';
export type MascotPresentation='compact'|'hands'|'full';
export function observedActivity(input:{microphone:boolean;speaking:boolean;task?:{state:string;chatId?:string;paused?:boolean};chatId?:string}):MascotActivity{
 const task=input.task,scoped=task&&(!task.chatId||task.chatId===input.chatId);
 // Actual playback wins visually; work indicators remain in the existing toolbar.
 if(input.speaking)return'speaking';
 if(input.microphone)return'listening';
 if(scoped&&task.paused)return'idle';
 if(scoped&&task.state==='failed')return'error';
 if(scoped&&task.state==='executing')return'executing';
 if(scoped&&['queued','thinking'].includes(task.state))return'thinking';
 return'idle';
}
/** No inference from user feelings, arbitrary words, or streaming text. */
export function automaticTone():ToneMetadata{return neutralTone();}
export function resolveWardrobe(tone:MascotTone,fixed:'auto'|Wardrobe):Wardrobe{return fixed==='auto'?toneWardrobe[tone]:fixed;}
/** Available illustrated faces, not a fabricated tone × wardrobe matrix. */
export function availableFace(tone:MascotTone,wardrobe:Wardrobe):MascotTone{
 // Preserve each original full-body pose and its matching head. The kit does
 // not contain every face × outfit combination; never paste a mismatched head.
 const illustrated:Record<Wardrobe,MascotTone>={signature:'neutral',light:'smug',all_black:'confident',cozy:'sad_empathic',layered:'playful_cocky'};
 return illustrated[wardrobe];
}
/** One playback identity; invalidated callbacks can never revive it. */
export class PlaybackLease {
 private serial=0;private current?:{id:number;chatId:string};
 start(chatId:string){const id=++this.serial;this.current={id,chatId};return id;}
 accepts(id:number,chatId:string){return this.current?.id===id&&this.current.chatId===chatId;}
 invalidate(){++this.serial;this.current=undefined;}
}
