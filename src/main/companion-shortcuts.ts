import type {CompanionSettings} from '../shared/codex-companion';
type Keys=Pick<CompanionSettings,'shortcut'|'returnShortcut'>;
type Registry={register:(key:string,callback:()=>void)=>boolean;unregister:(key:string)=>void};
export function registerCompanionShortcuts(registry:Registry,next:Keys,reveal:()=>void,open:()=>void,previous?:Keys){
 if(next.shortcut.toLowerCase()===next.returnShortcut.toLowerCase())throw Error('Usa atajos diferentes para la cápsula y el chat.');
 const clear=(keys:Keys)=>{registry.unregister(keys.shortcut);registry.unregister(keys.returnShortcut);};
 const apply=(keys:Keys)=>registry.register(keys.shortcut,reveal)&&registry.register(keys.returnShortcut,open);
 if(previous)clear(previous);
 try{if(!apply(next))throw Error('Uno de los atajos está ocupado o no es válido.');}
 catch(e){clear(next);if(previous)apply(previous);throw e;}
}
