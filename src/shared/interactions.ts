import {z} from 'zod';

const point=z.object({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)}).strict();
export const VisualReferenceSchema=z.object({id:z.string().uuid(),width:z.number().int().min(1).max(8000),height:z.number().int().min(1).max(8000),capturedAt:z.number().int().nonnegative(),source:z.string().max(200),crop:z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),width:z.number().int().positive(),height:z.number().int().positive()}).strict().optional()}).strict();
export type VisualReference=z.infer<typeof VisualReferenceSchema>;
export const VisualMarkSchema=z.object({imageId:z.string().uuid(),type:z.enum(['circle','arrow','stroke']),points:z.array(point).min(2).max(100),explanation:z.string().min(1).max(300)}).strict().refine(mark=>mark.type==='stroke'||mark.points.length===2);
export type VisualMark=z.infer<typeof VisualMarkSchema>;
export function responseMarks(text:string,reference?:VisualReference):VisualMark[]{
  if(!reference)return[];
  const block=/```zen-visual\s*([\s\S]*?)```/.exec(text);
  if(!block||block[1].length>12000)return[];
  try{const marks=z.array(VisualMarkSchema).max(8).parse(JSON.parse(block[1]));return marks.every(mark=>mark.imageId===reference.id)?marks:[];}catch{return[];}
}
export const GuideSchema=z.object({id:z.string().uuid(),projectId:z.string().uuid().nullable(),taskId:z.string().max(100),goal:z.string().min(1).max(2000),steps:z.array(z.string().min(1).max(4000)).min(1).max(20),index:z.number().int().nonnegative(),status:z.enum(['active','paused','completed']),updatedAt:z.number().int().nonnegative(),visual:VisualReferenceSchema.optional(),contextAt:z.number().int().nonnegative().optional()}).strict().refine(guide=>guide.index<guide.steps.length);
export type Guide=z.infer<typeof GuideSchema>;
export const InteractionsSchema=z.object({guides:z.array(GuideSchema).max(12),dismissed:z.array(z.string().max(100)).max(100)}).strict();
export type Interactions=z.infer<typeof InteractionsSchema>;
export const emptyInteractions:Interactions={guides:[],dismissed:[]};
export function guideStale(guide:Guide,now=Date.now()){const at=guide.contextAt??guide.visual?.capturedAt;return at!==undefined&&now-at>=120000;}
export function advanceGuide(guide:Guide,action:'previous'|'next'|'pause'|'resume',now=Date.now()):Guide{
  if(action==='pause')return{...guide,status:'paused',updatedAt:now};
  if(action==='resume')return{...guide,status:'active',updatedAt:now};
  if(action==='previous')return{...guide,index:Math.max(0,guide.index-1),status:guide.status==='completed'?'paused':guide.status,updatedAt:now};
  if(guide.status!=='active'||guideStale(guide,now))return guide;
  return {...guide,...(guide.index===guide.steps.length-1?{status:'completed' as const}:{index:guide.index+1}),updatedAt:now};
}
export function guideSteps(text:string){
  const clean=text.replace(/```zen-visual[\s\S]*?```/g,'').trim();
  const starts=[...clean.matchAll(/^\s*(?:\*\*)?\d+[.)]\s+/gm)];
  // Keep the literal answer intact when the model did not supply numbered steps.
  const steps=starts.length?starts.map((m,i)=>clean.slice(m.index!+m[0].length,starts[i+1]?.index??clean.length).trim()):[clean];
  return steps.filter(Boolean).slice(0,20).map(step=>step.slice(0,4000));
}
export function fileActions(names:string[]){return ['Resumir','Explicar',...(names.some(name=>/\.(?:[cm]?jsx?|tsx?|py|cs|sql|ps1|go|rs|java|cpp|html|css)$/i.test(name))?['Revisar código']:[]),...(names.some(name=>/\.(?:pdf|docx|xlsx|csv|json|xml)$/i.test(name))?['Extraer datos']:[]),'Preguntar'];}
export class SendGate{
  private active=new Set<string>();
  begin(key:string){if(this.active.has(key))return false;this.active.add(key);return true;}
  end(key:string){this.active.delete(key);}
}
