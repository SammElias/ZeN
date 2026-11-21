import React,{useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {ChevronDown,Copy,Eye,EyeOff,Fingerprint,KeyRound,LockKeyhole,MoreHorizontal,Plus,Search} from 'lucide-react';
import {VAULT_MASK,type VaultChange,type VaultProject,type VaultReply,type VaultRequest,type VaultSnapshot} from '../shared/password-vault';
import './PasswordVault.css';

// Call synchronously before taking outgoing visual snapshots or changing HUB sections.
export function concealVaultView(){window.dispatchEvent(new Event('zen-vault-conceal'));}
type AccountForm={project:string;id?:string;service:string;user:string;password:string;replace:boolean};
type Confirmation={text:string;change:VaultChange};
type Authentication={type:'unlock';master:string}|{type:'create';master:string;confirmation:string}|{type:'hello-unlock'};

export function PasswordVault(){
 const [state,setState]=useState<VaultSnapshot>({exists:true,locked:true});
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [master,setMaster]=useState(''),[confirmation,setConfirmation]=useState('');
 const [helloForm,setHelloForm]=useState(false),[helloMaster,setHelloMaster]=useState('');
 const [query,setQuery]=useState(''),[closed,setClosed]=useState<Set<string>>(new Set());
 const [projectForm,setProjectForm]=useState<{id?:string;name:string}>();
 const [accountForm,setAccountForm]=useState<AccountForm>();
 const [confirm,setConfirm]=useState<Confirmation>();
 const [revealed,setRevealed]=useState<{id:string;value:string}>();
 const session=useRef(''),alive=useRef(false),lockedEpoch=useRef(0),secretEpoch=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),working=useRef(false);
 const root=useRef<HTMLElement>(null);
 function hide(){secretEpoch.current++;clearTimeout(timer.current);setRevealed(undefined);}
 function clear(){
  lockedEpoch.current++;hide();setMaster('');setConfirmation('');setQuery('');setClosed(new Set());
  setProjectForm(undefined);setAccountForm(undefined);setConfirm(undefined);setMessage('');
  setHelloForm(false);setHelloMaster('');
  setState(previous=>({exists:previous.exists,locked:true,hello:previous.hello}));
 }
 useEffect(()=>{
  alive.current=true;
  const stop=window.companion.onVaultSignal(signal=>flushSync(()=>signal==='lock'?clear():hide()));
  const conceal=()=>flushSync(hide);
  const blur=()=>{conceal();void window.companion.vault({type:'conceal'});};
  const visibility=()=>{if(document.hidden)blur();};
  window.addEventListener('zen-vault-conceal',conceal);window.addEventListener('blur',blur);
  document.addEventListener('visibilitychange',visibility);
  void window.companion.vault({type:'enter'}).then(result=>{
   if(!alive.current)return;
   if(result.ok&&result.value.type==='state'){
    session.current=result.value.session??'';setState(result.value.state);setReady(true);
   }else setMessage(result.ok?'No se pudo abrir la bóveda.':result.error);
  });
  return ()=>{
   alive.current=false;lockedEpoch.current++;secretEpoch.current++;clearTimeout(timer.current);
   stop();window.removeEventListener('zen-vault-conceal',conceal);window.removeEventListener('blur',blur);
   document.removeEventListener('visibilitychange',visibility);
   void window.companion.vault({type:'lock'});
  };
 },[]);
 async function run(action:VaultRequest):Promise<VaultReply|undefined>{
  if(working.current)return;
  working.current=true;setBusy(true);setMessage('');const epoch=lockedEpoch.current;
  try {
   const result=await window.companion.vault(action);
   if(!alive.current||epoch!==lockedEpoch.current)return;
   if(!result.ok){setMessage(result.error);return;}
   if(result.value.type==='state')setState(result.value.state);
   return result.value;
  }catch {if(alive.current&&epoch===lockedEpoch.current)setMessage('No se pudo completar la operación.');}
  finally {working.current=false;if(alive.current)setBusy(false);}
 }
 async function change(value:VaultChange){
  hide();const result=await run({type:'change',session:session.current,change:value});
  if(result){setProjectForm(undefined);setAccountForm(undefined);setConfirm(undefined);setMessage('Cambios guardados.');}
 }
 async function authenticate(attempt:Authentication){
  if(working.current)return;
  // A lock revokes the old session, including when Windows locks while this view stays mounted.
  working.current=true;setBusy(true);
  try {
   const entered=await window.companion.vault({type:'enter'});
   if(!alive.current)return;
   if(!entered.ok||entered.value.type!=='state'){setMessage(entered.ok?'No se pudo abrir la bóveda.':entered.error);return;}
   session.current=entered.value.session??'';
  }finally{working.current=false;if(alive.current)setBusy(false);}
  if(!alive.current)return;
  await run({...attempt,session:session.current});
 }
 async function changeHello(masterValue?:string) {
  hide();setHelloMaster('');
  const result=await run(masterValue===undefined?{type:'hello-disable',session:session.current}:
   {type:'hello-enable',session:session.current,master:masterValue});
  if(result){
   setHelloForm(false);
   setMessage(masterValue===undefined?'Windows Hello desactivado en este equipo.':'Windows Hello activado en este equipo.');
  }
 }
 async function reveal(project:string,id:string){
  if(revealed?.id===id){hide();void window.companion.vault({type:'conceal'});return;}
  hide();const epoch=secretEpoch.current;
  const result=await run({type:'reveal',session:session.current,project,id});
  if(result?.type!=='secret'||epoch!==secretEpoch.current||!document.hasFocus())return;
  const remaining=Math.max(0,result.expiresAt-Date.now());
  if(!remaining)return;
  setRevealed({id,value:result.value});timer.current=setTimeout(hide,remaining);
 }
 async function copy(project:string,id:string,field:'user'|'password'){
  hide();const result=await run({type:'copy',session:session.current,project,id,field});
  if(result?.type==='copied')setMessage(field==='password'?'Contraseña copiada':'Usuario copiado');
 }
 const needle=query.trim().toLocaleLowerCase('es');
 const projects=(state.projects??[]).flatMap(project=>{
  const match=project.name.toLocaleLowerCase('es').includes(needle);
  const accounts=project.accounts.filter(account=>match||[account.service,account.user].some(value=>value.toLocaleLowerCase('es').includes(needle)));
  return match||accounts.length?[{...project,accounts,total:project.accounts.length}]:[];
 });
 function selectAccount(event:React.SyntheticEvent){
  const row=(event.target as Element).closest<HTMLElement>('[data-vault-account]');
  if(revealed&&row?.dataset.vaultAccount!==revealed.id)hide();
 }
 function beginAccount(project:VaultProject,id?:string){
  hide();setProjectForm(undefined);setConfirm(undefined);
  const account=project.accounts.find(value=>value.id===id);
  setAccountForm({project:project.id,id,service:account?.service??'',user:account?.user??'',password:'',replace:!id});
 }
 return <section ref={root} className="password-vault" aria-label="Bóveda de contraseñas" onPointerDownCapture={selectAccount} onFocusCapture={selectAccount}
  onCopy={event=>event.preventDefault()} onCut={event=>event.preventDefault()}>
  <header className="vault-heading"><span><KeyRound size={17}/>{state.locked?'Bóveda local cifrada':'Proyectos y cuentas'}</span>
   {!state.locked&&<div className="hub-tools">
    {state.hello&&<button type="button" aria-expanded={helloForm} disabled={busy}
     onClick={()=>{hide();setHelloMaster('');setHelloForm(!helloForm);}}><Fingerprint size={15}/>Windows Hello</button>}
    <button type="button" onClick={()=>{flushSync(clear);void window.companion.vault({type:'lock'});}}><LockKeyhole size={15}/>Bloquear</button>
   </div>}
  </header>
  {message&&<p className="hub-feedback" role="status">{message}</p>}
  {state.locked?<form className="hub-panel vault-unlock" onSubmit={event=>{
   event.preventDefault();hide();
   const value=master,confirmed=confirmation,exists=state.exists;
   setMaster('');setConfirmation('');void authenticate(exists?{type:'unlock',master:value}:{type:'create',master:value,confirmation:confirmed});
  }}>
   <LockKeyhole size={24}/><h2>{state.exists?'Desbloquear Contraseñas':'Crear contraseña maestra'}</h2>
   {state.hello==='enabled'&&<button type="button" disabled={!ready||busy}
    onClick={()=>{setMaster('');void authenticate({type:'hello-unlock'});}}><Fingerprint size={17}/>Desbloquear con Windows Hello</button>}
   <p>{state.exists?'Introduce tu contraseña maestra para ver proyectos, cuentas y búsquedas.':'La contraseña maestra será necesaria para recuperar el acceso a tus cuentas. ZEN no puede recuperarla si la olvidas. Guarda una copia segura antes de continuar.'}</p>
   <label>Contraseña maestra<input type="password" autoComplete={state.exists?'current-password':'new-password'} required value={master} onChange={event=>setMaster(event.target.value)} disabled={!ready||busy}/></label>
   {!state.exists&&<label>Confirmar contraseña maestra<input type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={!ready||busy}/></label>}
   <button className="hub-primary" disabled={!ready||busy||!master||!state.exists&&master!==confirmation} type="submit">{busy?'Abriendo…':state.exists?'Desbloquear':'Crear bóveda'}</button>
  </form>:<>
   {helloForm&&<form className="hub-panel vault-form" onSubmit={event=>{
    event.preventDefault();if(helloMaster)void changeHello(helloMaster);
   }}>
    <h2>Windows Hello</h2>
    {state.hello==='enabled'?<>
     <p>El desbloqueo con Windows Hello está activo en este equipo.</p>
     <div className="hub-tools"><button type="button" disabled={busy} onClick={()=>void changeHello()}>Desactivar Windows Hello</button></div>
    </>:<>
     <p>Usa el rostro, la huella o el PIN que tengas configurado en Windows. Conserva la contraseña maestra para recuperar el acceso o abrir la bóveda en otro equipo.</p>
     <label>Confirma la contraseña maestra<input type="password" autoComplete="current-password" value={helloMaster}
      onChange={event=>setHelloMaster(event.target.value)} required disabled={busy}/></label>
     <div className="hub-tools"><button className="hub-primary" type="submit" disabled={busy||!helloMaster}>{busy?'Verificando…':'Activar Windows Hello'}</button></div>
    </>}
   </form>}
   <div className="vault-toolbar"><label><Search size={15}/><input aria-label="Buscar en Contraseñas" placeholder="Proyecto, servicio o usuario…" value={query} onChange={event=>{hide();setQuery(event.target.value);}}/></label>
    <button type="button" onClick={()=>{hide();setAccountForm(undefined);setProjectForm({name:''});}}><Plus size={15}/>Nuevo proyecto</button></div>
   {projectForm&&<form className="hub-panel vault-form" onSubmit={event=>{event.preventDefault();void change({type:'project',...projectForm});}}>
    <label>Nombre del proyecto<input required autoFocus value={projectForm.name} onChange={event=>setProjectForm({...projectForm,name:event.target.value})}/></label>
    <div className="hub-tools"><button type="button" onClick={()=>setProjectForm(undefined)}>Cancelar</button><button className="hub-primary" disabled={busy} type="submit">Guardar proyecto</button></div>
   </form>}
   {accountForm&&<form className="hub-panel vault-form" autoComplete="off" onSubmit={event=>{
    event.preventDefault();const {replace,password,...fields}=accountForm;
    void change({type:'account',...fields,...(replace?{password}:{})});
   }}>
    <h2>{accountForm.id?'Editar cuenta':'Añadir cuenta'}</h2>
    <label>Servicio<input required autoFocus value={accountForm.service} onChange={event=>setAccountForm({...accountForm,service:event.target.value})}/></label>
    <label>Correo o usuario<input value={accountForm.user} onChange={event=>setAccountForm({...accountForm,user:event.target.value})}/></label>
    {accountForm.replace?<label>Nueva contraseña<span className="vault-fixed-input"><input aria-label="Nueva contraseña" type="password" autoComplete="new-password" required value={accountForm.password} onChange={event=>setAccountForm({...accountForm,password:event.target.value})}/><span aria-hidden="true">{VAULT_MASK}</span></span></label>:<div className="vault-preserved"><span>Contraseña {VAULT_MASK}</span><button type="button" onClick={()=>setAccountForm({...accountForm,replace:true})}>Cambiar contraseña</button></div>}
    <div className="hub-tools"><button type="button" onClick={()=>{hide();setAccountForm(undefined);}}>Cancelar</button><button className="hub-primary" disabled={busy} type="submit">Guardar cuenta</button></div>
   </form>}
   {confirm&&<div className="hub-panel vault-confirm" role="alertdialog" aria-label="Confirmar eliminación"><p>{confirm.text}</p><div className="hub-tools"><button autoFocus type="button" onClick={()=>setConfirm(undefined)}>Cancelar</button><button type="button" disabled={busy} onClick={()=>void change(confirm.change)}>Confirmar eliminación</button></div></div>}
   <div className="vault-projects">{projects.map(project=><article key={project.id} className="hub-panel vault-project">
    <header><button type="button" className="vault-project-toggle" aria-expanded={!!needle||!closed.has(project.id)} onClick={()=>{
     hide();setClosed(previous=>{const next=new Set(previous);next.has(project.id)?next.delete(project.id):next.add(project.id);return next;});
    }}><ChevronDown size={15}/><strong>{project.name}</strong><small>{project.total} {project.total===1?'cuenta':'cuentas'}</small></button>
     <button type="button" onClick={()=>beginAccount(project)}><Plus size={14}/>Añadir cuenta</button>
     <details className="hub-menu"><summary aria-label={'Opciones de '+project.name}><MoreHorizontal size={16}/></summary><div>
      <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');hide();setProjectForm({id:project.id,name:project.name});setAccountForm(undefined);}}>Renombrar</button>
      <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');hide();setConfirm({text:'¿Eliminar «'+project.name+'» y sus '+project.total+' cuentas?',change:{type:'removeProject',id:project.id,accounts:project.total}});}}>Eliminar proyecto</button>
     </div></details>
    </header>
    {(!!needle||!closed.has(project.id))&&<div>{project.accounts.map(account=><div className="vault-account" key={account.id} data-vault-account={account.id}>
     <div className="vault-identity"><strong>{account.service}</strong><span>{account.user||'Sin usuario'}</span></div>
     <span className="vault-secret" data-vault-secret={account.id}>{revealed?.id===account.id?revealed.value:VAULT_MASK}</span>
     <div className="vault-actions"><button type="button" disabled={busy} title="Copiar usuario" aria-label={'Copiar usuario de '+account.service+' '+account.user} onClick={()=>void copy(project.id,account.id,'user')}><Copy size={14}/><span>Copiar usuario</span></button>
      <button type="button" disabled={busy} title="Copiar contraseña" aria-label={'Copiar contraseña de '+account.service+' '+account.user} onClick={()=>void copy(project.id,account.id,'password')}><KeyRound size={14}/><span>Copiar contraseña</span></button>
      <button type="button" disabled={busy} aria-label={revealed?.id===account.id?'Ocultar contraseña':'Mostrar contraseña durante 10 segundos'} aria-pressed={revealed?.id===account.id} onClick={()=>void reveal(project.id,account.id)}>{revealed?.id===account.id?<EyeOff size={15}/>:<Eye size={15}/>}</button>
      <details className="hub-menu"><summary aria-label={'Opciones de cuenta '+account.service+' '+account.user}><MoreHorizontal size={16}/></summary><div>
       <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');beginAccount(project,account.id);}}>Editar</button>
       <button type="button" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');hide();setConfirm({text:'¿Eliminar la cuenta «'+account.service+'» de '+account.user+'?',change:{type:'removeAccount',project:project.id,id:account.id}});}}>Eliminar</button>
      </div></details>
     </div>
    </div>)}{!project.total&&<p className="hub-muted">Añade la primera cuenta de este proyecto.</p>}</div>}
   </article>)}{!projects.length&&<p className="hub-muted">{needle?'No hay resultados.':'Crea un proyecto para guardar tus cuentas.'}</p>}</div>
  </>}
 </section>;
}
