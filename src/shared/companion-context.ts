import {z} from 'zod';
export const ContextInput=z.object({kind:z.enum(['file','page','text']),file:z.string().uuid().optional(),url:z.string().max(2048).default(''),text:z.string().max(24000).default(''),instruction:z.string().trim().min(1).max(2000)}).strict().superRefine((v,c)=>{
 if(v.kind==='file'&&(!v.file||v.url||v.text)||v.kind!=='file'&&v.file)c.addIssue({code:'custom',message:'Selecciona el contenido de esta petición.'});
 if(v.kind==='page'){try{const u=new URL(v.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{c.addIssue({code:'custom',message:'Usa una dirección web HTTP o HTTPS sin credenciales.'});}}
 if(v.kind==='text'&&(!v.text.trim()||v.url))c.addIssue({code:'custom',message:'Pega el texto que quieres analizar.'});
 if(/[\x00-\x08\x0b-\x1f\x7f]/.test(v.instruction+v.text+v.url))c.addIssue({code:'custom',message:'El texto contiene caracteres no admitidos.'});
});
export type ContextInput=z.input<typeof ContextInput>;
export type ContextFile={id:string;name:string};
export type ContextPreview={id:string;prompt:string;targetTitle:string;label:string;expiresAt:number};
