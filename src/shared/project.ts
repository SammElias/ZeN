import { z } from 'zod';
export const ProjectBundleSchema=z.object({
  name:z.string().min(1).max(100),summary:z.string().max(600),
  directories:z.array(z.string().min(1).max(600)).max(80),
  files:z.array(z.object({path:z.string().min(1).max(600),content:z.string().max(200000)}).strict()).max(50)
}).strict();
export type ProjectBundle=z.infer<typeof ProjectBundleSchema>;
export type ProjectDraft={id:string;name:string;summary:string;paths:string[];directories:string[];destination?:string;approvalId?:string};
export type WorkContext={owner:'codex';phase:'preparing'|'review'|'saving'|'complete'|'incomplete'|'external';draft?:ProjectDraft};
/** A desktop handoff is not a request for input or approval inside ZEN. */
export function isExternalCodexTask(task:{state:string;workContext?:WorkContext}){return task.state==='awaiting_input'&&task.workContext?.owner==='codex'&&task.workContext.phase==='external';}
