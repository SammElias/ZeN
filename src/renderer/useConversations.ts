import {useEffect,useRef,useState} from 'react';
import type {ChatDraft,ChatSnapshot,ConversationCommand,ConversationReply} from '../shared/conversations';

export function useConversations(projectId:string|null,ready:boolean,restore:(s:ChatSnapshot)=>void,notify:(s:string)=>void,readDraft?:()=>ChatDraft){
 const enabled=!window.zenDemo||new URLSearchParams(location.search).has('conversations');
 const [snapshot,setSnapshot]=useState<ChatSnapshot>(),[loading,setLoading]=useState(enabled),[revision,setRevision]=useState(0);
 const active=useRef<string|undefined>(undefined),callbacks=useRef({restore,notify,readDraft});callbacks.current={restore,notify,readDraft};
 const pendingDraft=useRef<ChatDraft|undefined>(undefined),saving=useRef<Promise<unknown>>(Promise.resolve()),generation=useRef(0);
 const call=async(command:ConversationCommand):Promise<ConversationReply>=>{const r=await window.zen.conversations(command);if(!r.ok)throw new Error(r.error);if(command.action==='delete-confirm'&&active.current===command.id){active.current=undefined;pendingDraft.current=undefined;}if(r.value.notice)callbacks.current.notify(r.value.notice);return r.value;};
 const save=(draft:ChatDraft)=>{pendingDraft.current=draft;const id=active.current;if(!enabled||!id)return;const operation=()=>call({action:'draft',id,draft});saving.current=saving.current.then(operation,operation).catch(e=>callbacks.current.notify(e.message));};
 const open=async(command:ConversationCommand)=>{const stamp=++generation.current;if(active.current&&callbacks.current.readDraft)save(callbacks.current.readDraft());setLoading(true);try{await saving.current;const r=await call(command);if(stamp!==generation.current)return;if(r.snapshot){active.current=r.snapshot.chat.id;pendingDraft.current=r.snapshot.draft;setSnapshot(r.snapshot);callbacks.current.restore(r.snapshot);}setRevision(v=>v+1);}finally{if(stamp===generation.current)setLoading(false);}};
 useEffect(()=>{if(enabled&&ready)void open({action:'active',projectId}).catch(e=>callbacks.current.notify(e.message));},[projectId,ready]);
 useEffect(()=>{if(!enabled)return;return window.zen.onConversation(({chatId})=>{setRevision(v=>v+1);if(chatId!==active.current)return;void call({action:'activity',id:chatId}).then(r=>{if(chatId===active.current&&r.updates)setSnapshot(previous=>previous?.chat.id===chatId?{...previous,...r.updates}:previous);}).catch(()=>{if(chatId===active.current)void open({action:'active',projectId}).catch(e=>callbacks.current.notify(e.message));});});},[projectId]);
 const refresh=async()=>{const id=active.current;if(!id)return;const r=await call({action:'read',id});if(id===active.current&&r.snapshot)setSnapshot(r.snapshot);setRevision(v=>v+1);};
 return{enabled,snapshot,loading,active,revision,call,open,save,refresh,flush:()=>saving.current};
}
