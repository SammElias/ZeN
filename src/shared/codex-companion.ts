import {z} from 'zod';
export const CompanionSettingsSchema=z.object({shortcut:z.string().min(3).max(80).default('Control+Alt+Z'),returnShortcut:z.string().min(3).max(80).default('Control+Alt+C'),motion:z.boolean().default(true),sounds:z.boolean().default(true),notifications:z.boolean().default(true),paused:z.boolean().default(false),silencedUntil:z.number().int().nonnegative().max(8640000000000000).default(0)}).strict();
export type CompanionSettings=z.infer<typeof CompanionSettingsSchema>;
export const CompanionTargetSchema=z.object({session:z.string().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/),cwd:z.string().min(3).max(4096).regex(/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/).refine(v=>!/[\0\r\n]/.test(v)),title:z.string().trim().min(1).max(200)}).strict();
export type CompanionTarget=z.infer<typeof CompanionTargetSchema>;
export const hookEvents=['SessionStart','UserPromptSubmit','PreToolUse','PermissionRequest','PostToolUse','Stop','SubagentStart','SubagentStop','Interrupt','SessionEnd'] as const;
export const CompanionEventSchema=z.object({id:z.string().uuid(),event:z.enum(hookEvents),session:z.string().min(1).max(160),turn:z.string().max(160).optional(),cwd:z.string().max(4096),tool:z.string().max(300).optional(),preview:z.string().max(100000).optional(),truncated:z.boolean().default(false),failed:z.boolean().default(false)}).strict();
export type CompanionEvent=z.infer<typeof CompanionEventSchema>;
export type CompanionPhase='idle'|'thinking'|'working'|'approval'|'finished'|'error'|'interrupted'|'unknown';
export type CompanionSession={id:string;turn?:string;label:string;title?:string;cwd:string;state:CompanionPhase;tool?:string;at:number;observation?:{since:number;startedAt?:number;endedAt?:number;actions:number};steps:{id:string;label:string;preview?:string;at:number}[]};
export type CompanionApproval={id:string;session:string;turn:string;label:string;tool:string;preview:string;expiresAt:number};
export type CompanionNotice={id:string;session:string;title:string;kind:'permission'|'finished'|'error';read:boolean;at:number};
export type CompanionConnection={state:'unchecked'|'missing'|'review'|'disabled'|'ready'|'unavailable';checkedAt?:number;total:number;trusted:number;enabled:number};
export type CompanionStatus={settings:CompanionSettings;target?:CompanionTarget;ignoredEvents?:number;targetError?:string;account:'unchecked'|'chatgpt'|'missing'|'unsupported';checking:boolean;integration:'missing'|'waiting'|'receiving';connection?:CompanionConnection;sessions:CompanionSession[];approvals:CompanionApproval[];notices:CompanionNotice[];lastEventAt?:number;error?:string};
export type CompanionResult<T>={ok:true;value:T}|{ok:false;error:string};
export interface CompanionBridge{
 status():Promise<CompanionResult<CompanionStatus>>;onStatus(cb:(v:CompanionStatus)=>void):()=>void;
 openCodex(id?:string):Promise<CompanionResult<boolean>>;check():Promise<CompanionResult<boolean>>;
 settings():Promise<CompanionResult<boolean>>;install():Promise<CompanionResult<boolean>>;save(value:CompanionSettings):Promise<CompanionResult<boolean>>;
 menu(open:boolean):Promise<CompanionResult<boolean>>;panel(view:'activity'|'approvals'|'notices'):Promise<CompanionResult<boolean>>;
 decide(id:string,decision:'allow'|'deny'|'pass'):Promise<CompanionResult<boolean>>;clearNotices():Promise<CompanionResult<boolean>>;
 copy(text:string):Promise<CompanionResult<boolean>>;
 sound(enabled:boolean):Promise<CompanionResult<boolean>>;silence(minutes:0|30):Promise<CompanionResult<boolean>>;testNotice():Promise<CompanionResult<boolean>>;
 hide():Promise<CompanionResult<boolean>>;drag(action:'start'|'end'):Promise<CompanionResult<boolean>>;
 cursor():Promise<CompanionResult<{x:number;y:number}|null>>;onCursor(cb:(v:{x:number;y:number}|null)=>void):()=>void;
}
declare global{interface Window{companion:CompanionBridge;}}
