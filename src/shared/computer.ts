import {z} from 'zod';
import {humanCommand} from '../policy/command';
import {ZenError} from './errors';
const point={x:z.number().int().nonnegative(),y:z.number().int().nonnegative()};
const modifiers=z.array(z.enum(['CTRL','ALT','SHIFT'])).max(3).nullish();
export const ComputerActionSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('click'),...point,button:z.enum(['left','right','wheel','back','forward']),keys:modifiers}).strict(),
  z.object({type:z.literal('double_click'),...point,keys:modifiers}).strict(),
  z.object({type:z.literal('move'),...point,keys:modifiers}).strict(),
  z.object({type:z.literal('drag'),path:z.array(z.object(point).strict()).min(2).max(40),keys:modifiers}).strict(),
  z.object({type:z.literal('scroll'),...point,scroll_x:z.number().int().min(-2000).max(2000),scroll_y:z.number().int().min(-2000).max(2000),keys:modifiers}).strict(),
  z.object({type:z.literal('keypress'),keys:z.array(z.string().min(1).max(20)).min(1).max(4)}).strict(),
  z.object({type:z.literal('type'),text:z.string().min(1).max(2000)}).strict(),
  z.object({type:z.literal('wait')}).strict(),z.object({type:z.literal('screenshot')}).strict()
]);
export type ComputerAction=z.infer<typeof ComputerActionSchema>;
export const computerEffect=(action:ComputerAction)=>!['screenshot','wait','scroll','move'].includes(action.type)||!!('keys'in action&&action.keys?.length);
export function computerActions(raw:unknown,width:number,height:number){
  const actions=z.array(ComputerActionSchema).min(1).max(8).parse(raw);
  for(const action of actions){
    const points='x'in action?[action]:action.type==='drag'?action.path:[];
    if(points.some(p=>p.x>=width||p.y>=height))throw new ZenError('Acción fuera de la ventana observada.');
    if(action.type==='keypress'){
      action.keys=action.keys.map(key=>key.toUpperCase().replace(/^CONTROL$/,'CTRL').replace(/^RETURN$/,'ENTER').replace(/^ESCAPE$/,'ESC').replace(/^ARROW/,''));
      const allowed=/^(?:[A-Z0-9]|CTRL|ALT|SHIFT|ENTER|TAB|ESC|BACKSPACE|DELETE|SPACE|UP|DOWN|LEFT|RIGHT|HOME|END|PAGEUP|PAGEDOWN|F[1-9]|F10|F11)$/;
      if(action.keys.some(key=>!allowed.test(key))||action.keys.includes('ALT')&&action.keys.some(key=>['TAB','F4','SPACE','ESC'].includes(key))||action.keys.includes('CTRL')&&action.keys.includes('SHIFT')&&action.keys.some(key=>['I','J','C','ESC'].includes(key)))throw new ZenError('Atajo global, terminal o herramientas de desarrollo bloqueado.');
    }
    if(action.type==='type'&&/(?:javascript:|\b(?:powershell|pwsh|cmd\.exe|bash|wscript|cscript|eval\(|exec\(|subprocess|os\.system|child_process|curl\s|wget\s|npm\s|npx\s|pip\s)|<script\b)/i.test(action.text))throw new ZenError('Computer Use no ejecuta comandos ni código local.');
  }
  return actions;
}
export function computerRequest(text:string){
  const value=humanCommand(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /^(?:abre(?:r)?|abrir|controla(?:r)?|usa(?:r)?|maneja(?:r)?|trabaja(?:r)?|navega(?:r)?|haz|crea(?:r)?|configura(?:r)?|rellena(?:r)?|revisa(?:r)?|analiza(?:r)?|comprueba|modifica(?:r)?|organiza(?:r)?)\b/.test(value)&&/\b(?:pantalla|equipo|computer use|dataverse|power apps|powerapps|power automate|powerautomate|flujo|flujos|navegador|aplicacion|excel|word|powerpoint|formulario)\b/.test(value)&&! /\bno\s+(?:controles|uses|manejes|actues|hagas clic|escribas)\b/.test(value);
}
export function actionReview(actions:ComputerAction[]){return actions.map(a=>a.type==='type'?`Escribir: ${JSON.stringify(a.text)}`:a.type==='keypress'?`Teclas: ${a.keys.join(' + ')}`:a.type==='drag'?`Arrastrar: ${JSON.stringify(a.path)}`:'x'in a?`${a.type} (${a.x}, ${a.y})${'button'in a?` ${a.button}`:''}${'keys'in a&&a.keys?.length?` + ${a.keys.join('+')}`:''}`:a.type).join('\n');}
