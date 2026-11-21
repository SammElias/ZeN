import type {MenuItemConstructorOptions} from 'electron';
import type {CompanionSettings} from '../shared/codex-companion';
import type {CapsuleAlignment} from '../shared/overlay-position';
import {CapsuleLocation} from '../shared/workspace-layout';
import {isSilenced} from '../shared/companion-presentation';

type Action = () => unknown;
type Context = {
 settings:CompanionSettings; location:CapsuleLocation; full:boolean; nativeHover:boolean; simpleMode:boolean;
 previousApp:{available:boolean;name?:string};
 setLocation:(location:CapsuleLocation)=>unknown; move:(alignment:CapsuleAlignment)=>unknown;
 update:(settings:Partial<CompanionSettings>)=>unknown;
 layout:Action; toggleSimpleMode:Action; appearance:Action; openChat:Action; openNotices:Action; restoreApp:Action; hide:Action; quit:Action;
 run:(action:Action)=>void;
};

export function capsuleMenuItems(c:Context):MenuItemConstructorOptions[] {
 const locations={top:'Arriba',left:'Izquierda',right:'Derecha',floating:'Flotante'} as const;
 const at:MenuItemConstructorOptions[]=CapsuleLocation.options.map(value=>({type:'radio',label:locations[value],
  checked:value===c.location,click:()=>c.run(()=>c.setLocation(value))}));
 const commands:MenuItemConstructorOptions[]=[
  {type:'separator'},{label:'Minimizar ZEN',click:()=>c.run(c.hide)},{label:'Salir de ZEN',click:()=>c.run(c.quit)},
 ];
 if(!c.full)return [...at,...commands];
 const {settings}=c;
 const item=(label:string,action:Action,enabled=true):MenuItemConstructorOptions=>({label,enabled,click:()=>c.run(action)});
 const check=(label:string,key:'alwaysOnTop'|'windowLocked'|'keepExpanded'|'sounds'|'presentation'):MenuItemConstructorOptions=>({
  type:'checkbox',label,checked:settings[key],click:()=>c.run(()=>c.update({[key]:!settings[key]})),
 });
 const quiet=isSilenced(settings);
 return [
  item('Volver a '+(!settings.presentation&&c.previousApp.name||'mi aplicación'),c.restoreApp,c.previousApp.available),
  item('Volver al chat fijado',c.openChat),
  item('Ver avisos',c.openNotices,!settings.presentation&&!settings.paused),
  {type:'separator'},
  {label:'Ajustar posición',enabled:!settings.windowLocked,submenu:[
   item('Mover al extremo izquierdo',()=>c.move('left')),
   item(c.location==='left'||c.location==='right'?'Centrar en vertical':'Centrar en este monitor',()=>c.move('center')),
   item('Mover al extremo derecho',()=>c.move('right')),
  ]},
  item('Distribución de ventana',c.layout),
  {type:'checkbox',label:'Modo simple',checked:c.simpleMode,click:()=>c.run(c.toggleSimpleMode)},
  check('Siempre encima','alwaysOnTop'),
  c.nativeHover?check('Fijar panel y posición','windowLocked'):check('Mantener panel abierto','keepExpanded'),
  {type:'separator'},
  item('Apariencia y preferencias',c.appearance),check('Sonidos de aviso','sounds'),
  item(quiet?'Reactivar avisos':'Silenciar avisos 30 min',()=>c.update({silencedUntil:quiet?0:Date.now()+1800000})),
  check('Presentación','presentation'),
  ...commands,
 ];
}
