import React,{useCallback} from 'react';
import {CodexResultPanel} from './CodexResultPanel';
export function MailReplyEditor({thread,disabled}:{thread:string;disabled:boolean}){
 const read=useCallback(()=>window.companion.gmailResult(thread),[thread]);
 return <CodexResultPanel read={read} disabled={disabled} mail/>;
}
