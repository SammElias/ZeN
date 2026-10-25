import {useCallback,useEffect,useRef,useState} from 'react';
import type {CompanionStatus} from '../shared/codex-companion';
import type {GmailSummary} from '../shared/companion-gmail';

/** Counts only; the Home view never asks for subjects or message bodies. */
export function useHomeMail(status:CompanionStatus){
 const [mail,setMail]=useState<GmailSummary>(),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const epoch=useRef(0),flight=useRef<object|undefined>(undefined),mounted=useRef(true),allowed=useRef(false);
 const enabled=!!status.workspace?.expanded&&status.workspace.page==='home'&&!status.settings.presentation&&!status.settings.paused;
 allowed.current=enabled;
 const refresh=useCallback(async()=>{
  if(!allowed.current||document.hidden||flight.current)return;
  const marker={},generation=epoch.current;flight.current=marker;setLoading(true);
  const current=()=>mounted.current&&allowed.current&&!document.hidden&&generation===epoch.current;
  try{const result=await window.companion.gmailSummary();if(!current())return;if(result.ok){setMail(result.value);setError(false);}else setError(true);}
  catch{if(current())setError(true);}
  finally{if(flight.current===marker)flight.current=undefined;if(current())setLoading(false);}
 },[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;flight.current=undefined;};},[]);
 useEffect(()=>{
  const visible=()=>{epoch.current++;flight.current=undefined;setMail(undefined);setLoading(false);setError(false);if(enabled&&!document.hidden)void refresh();};
  visible();document.addEventListener('visibilitychange',visible);
  const timer=enabled?setInterval(()=>{if(!document.hidden)void refresh();},60000):undefined;
  return()=>{epoch.current++;flight.current=undefined;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[enabled,refresh]);
 const visible=enabled&&!document.hidden;
 return{mail:visible?mail:undefined,loading:visible&&loading,error:visible&&error,refresh};
}
