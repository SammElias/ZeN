import type {CodexResult} from '../shared/companion-codex-result';
export type ResultDraft={result?:CodexResult;text:string;dirty:boolean;pending?:CodexResult};
export const emptyResultDraft=():ResultDraft=>({text:'',dirty:false});
export function receiveResult(draft:ResultDraft,result:CodexResult):ResultDraft{
 if(draft.result?.id===result.id||draft.pending?.id===result.id)return draft;
 if(draft.dirty)return{...draft,pending:{...result}};
 return{result:{...result},text:result.text,dirty:false};
}
export function editResult(draft:ResultDraft,text:string):ResultDraft{return{...draft,text,dirty:true};}
export function applyPendingResult(draft:ResultDraft):ResultDraft{return draft.pending?{result:draft.pending,text:draft.pending.text,dirty:false}:draft;}
