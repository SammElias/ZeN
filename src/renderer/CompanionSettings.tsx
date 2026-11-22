import React, {useState} from 'react';
import {defaultAppearance,type AppearanceState} from '../shared/companion-appearance';
import type {CompanionResult, CompanionSettings as Settings, CompanionStatus} from '../shared/codex-companion';
import {connectionLabel, isSilenced} from '../shared/companion-presentation';
import {interfaceSoundEnabled} from '../shared/companion-interface-audio';
import {AppearanceSettings} from './AppearanceSettings';
import {BackupSettings} from './BackupSettings';
import {ProfileSyncSettings} from './ProfileSyncSettings';
import {CapsulePosition} from './CapsulePosition';
import {CompanionIcon, OpenCodex, Quiet, Signal} from './CompanionActions';
import {PreferenceRow,PreferenceSave,PreferenceSwitch,type PreferenceFeedback} from './PreferencesControls';
import {interfaceAudio, interfaceAudioMuted} from './companion-interface-audio';
import {ZenEmblem} from './ZenEmblem';

const categories={
 appearance:{title:'Apariencia',icon:'settings',description:'Personaliza el tema, el fondo y el acabado del cristal.'},
 capsule:{title:'Cápsula y panel',icon:'presentation',description:'Elige dónde aparece ZEN y cómo se comporta su ventana.'},
 audio:{title:'Sonidos y avisos',icon:'bell',description:'Controla los efectos de interfaz, los avisos y las notificaciones.'},
 shortcuts:{title:'Atajos',icon:'code',description:'Cambia las combinaciones de teclado de ZEN.'},
 data:{title:'Datos y configuración',icon:'folder',description:'Traslada tus datos a otro equipo o recupera una copia.'},
 connection:{title:'Conexión y diagnóstico',icon:'pin',description:'Revisa la conexión con Codex y el estado de la integración local.'},
} as const;
type Category=keyof typeof categories;
const categoryKeys=Object.keys(categories) as Category[];
const categoryStorage='zen.preferences.category';

const windowOptions=[
 ['alwaysOnTop','Siempre encima','Mantiene ZEN delante de otras aplicaciones.'],
 ['followPointerDisplay','Monitor del puntero','Abre la cápsula en el monitor donde está el puntero.'],
 ['respectFullscreen','Respetar pantalla completa','Oculta la cápsula sobre aplicaciones a pantalla completa.'],
 ['dismissCapsuleOnOutsideClick','Minimizar al hacer clic fuera','Minimiza la cápsula cuando haces clic en otra ventana.'],
 ['collapseOnBlur','Ocultar panel al perder el foco','Deja la cápsula pequeña al pasar a otra aplicación.'],
 ['hideCapsuleFromTaskbar','Ocultar cápsula de la barra de tareas','También la oculta de Alt+Tab mientras está recogida.'],
 ['motion','Animaciones de estado','Aplica transiciones a la cápsula y a los paneles.'],
] as const;
const noticeOptions=[
 ['sounds','Sonidos de aviso','Emite un tono cuando ZEN recibe un aviso.'],
 ['notifications','Notificaciones de Windows','Muestra los avisos de ZEN en el sistema.'],
 ['presentation','Modo presentación','Oculta contenido privado y silencia los avisos.'],
 ['paused','Pausar recepción y avisos','Pausa temporalmente la actividad observada y los avisos de ZEN.'],
] as const;
const shortcuts=[['shortcut','Mostrar cápsula'],['returnShortcut','Volver al chat de Codex']] as const;

function lastCategory():Category {
 try{
  const saved=localStorage.getItem(categoryStorage);
  return categoryKeys.find(key=>key===saved)??'appearance';
 }catch{return 'appearance';}
}

export function CompanionSettings({status,visible,onBack,onLayout,onPreview,onCategoryChange,onBackupImported}: {
 status:CompanionStatus;visible:boolean;onBack:()=>void;onLayout:()=>void;
 onPreview:(appearance:AppearanceState|undefined)=>void;onCategoryChange:()=>void;onBackupImported:()=>void;
}) {
 const [category,setCategory]=useState(lastCategory);
 const [changes,setChanges]=useState<Partial<Record<Category,Partial<Settings>>>>({});
 const [feedback,setFeedback]=useState<Partial<Record<Category,PreferenceFeedback>>>({});
 const [immediateFeedback,setImmediateFeedback]=useState<PreferenceFeedback>();
 const [busy,setBusy]=useState(false);
 const [backupRevision,setBackupRevision]=useState(0);
 const [restoreAppearance,setRestoreAppearance]=useState(0);

 const categoryMeta=categories[category];
 const patch=changes[category]??{};
 const draft={...status.settings,...patch};
 const dirty=(Object.keys(patch) as (keyof Settings)[]).some(key=>draft[key]!==status.settings[key]);
 const audioEnabled=interfaceSoundEnabled(draft);
 const layout=status.workspace?.layout;

 function select(next:Category) {
  if(category===next)return;
  setCategory(next);
  setImmediateFeedback(undefined);
  try{localStorage.setItem(categoryStorage,next);}catch{/* The category still persists for this session. */}
  onCategoryChange();
 }

 function edit(key:keyof Settings,value:Settings[keyof Settings]) {
  setChanges(previous=>{
   const next={...previous[category],[key]:value};
   if(value===status.settings[key])delete next[key];
   return {...previous,[category]:next};
  });
  setFeedback(previous=>({...previous,[category]:undefined}));
 }

 function discard() {
  setChanges(previous=>({...previous,[category]:undefined}));
  setFeedback(previous=>({...previous,[category]:undefined}));
 }

 async function save() {
  setBusy(true);
  setFeedback(previous=>({...previous,[category]:undefined}));
  try{
   const result=await window.companion.save(draft);
   if(result.ok){
    setChanges(previous=>({...previous,[category]:undefined}));
    interfaceAudio.configure(draft);
   }
   interfaceAudio.play(result.ok?'success':'error');
   setFeedback(previous=>({...previous,[category]:result.ok?{text:'Preferencias guardadas.'}:{text:result.error,error:true}}));
  }catch{
   setFeedback(previous=>({...previous,[category]:{text:'No se pudieron guardar las preferencias.',error:true}}));
  }finally{setBusy(false);}
 }

 async function immediate(action:()=>Promise<CompanionResult<boolean>>,success?:string) {
  setImmediateFeedback(undefined);
  try{
   const result=await action();
   if(!result.ok)setImmediateFeedback({text:result.error,error:true});
   else if(success)setImmediateFeedback({text:success});
  }catch{setImmediateFeedback({text:'No se pudo completar el cambio.',error:true});}
 }

 async function testNotice() {
  if(status.settings.presentation||isSilenced(status.settings)){
   setImmediateFeedback({text:'Desactiva Presentación o reactiva los avisos para probar la notificación.',error:true});
   return;
  }
  await immediate(async()=>{
   const result=await window.companion.testNotice();
   if(result.ok)interfaceAudio.notice('success');
   return result;
  },'Aviso de prueba enviado. Comprueba la notificación.');
 }

 const saveBar=<PreferenceSave dirty={dirty} busy={busy} feedback={feedback[category]} onDiscard={discard} onSave={()=>void save()}/>;
 const booleanRows=(items:readonly (typeof windowOptions[number]|typeof noticeOptions[number])[])=>items.map(([key,title,description])=>
  <PreferenceSwitch key={key} checked={draft[key]} title={title} description={description} onChange={value=>edit(key,value)}/>);

 return <div className="preferences-center">
  <aside className="preferences-sidebar">
   <button type="button" className="preferences-back" onClick={onBack}><CompanionIcon name="return"/>Volver</button>
   <div className="preferences-title"><span><ZenEmblem/></span><h1>Preferencias</h1></div>
   {status.workspace?.simpleMode?<select className="preferences-category-select" aria-label="Categoría de preferencias"
    value={category} onChange={event=>{const next=categoryKeys.find(key=>key===event.currentTarget.value);if(next)select(next);}}>
    {categoryKeys.map(key=><option key={key} value={key}>{categories[key].title}</option>)}
   </select>:<nav className="preferences-nav" aria-label="Categorías de Preferencias">
    {categoryKeys.map(key=><button type="button" key={key} data-category={key} aria-current={category===key?'page':undefined} aria-controls="preferences-panel" onClick={()=>select(key)}>
     <CompanionIcon name={categories[key].icon}/><span>{categories[key].title}</span>
     {category===key&&<CompanionIcon name="check"/>}
    </button>)}
   </nav>}
  </aside>
  <section className="preferences-content" id="preferences-panel" aria-labelledby="preferences-category-title">
   <header className="preferences-category-heading" key={category}>
    <h2 id="preferences-category-title">{categoryMeta.title}</h2><p>{categoryMeta.description}</p>
   </header>
   <div className="preferences-page" hidden={category!=='appearance'} inert={category!=='appearance'}>
    {status.settings.presentation?<p role="status">Desactiva Presentación para editar la apariencia.</p>:
     <AppearanceSettings key={backupRevision} value={status.appearance??defaultAppearance} visible={visible&&status.workspace?.surfaceVisible===true&&category==='appearance'} motion={status.settings.motion} reset={restoreAppearance} onPreview={onPreview}/>}
   </div>
   {category==='capsule'&&<div className="preferences-page">
    <h3>Ubicación y restauración</h3>
    <PreferenceRow title="Ubicación de ZEN" description="Se aplica al elegir una posición.">
     <CapsulePosition location={status.workspace?.location} ready={Boolean(status.workspace)} cards/>
    </PreferenceRow>
    <PreferenceSwitch title="Fijar panel y posición" description="Detiene la apertura y el repliegue al pasar el cursor y bloquea el arrastre. Puedes abrir y recoger ZEN con sus controles." checked={status.settings.windowLocked}
     onChange={value=>void immediate(()=>window.companion.pinWindow(value))}/>
    {!status.workspace?.nativeCaption&&<PreferenceSwitch title="Mantener panel abierto" description="Conserva abierto el panel al pasar a otra aplicación." checked={status.settings.keepExpanded}
     onChange={value=>void immediate(()=>window.companion.keepExpanded(value))}/>}
    {layout&&<PreferenceSwitch title="Restaurar al iniciar ZEN" description="Recupera la presentación y la geometría guardadas." checked={layout.restoreOnLaunch}
     onChange={value=>void immediate(()=>window.companion.workspaceLayoutPreferences({...layout,restoreOnLaunch:value}))}/>}
    <PreferenceRow title="Distribución de ventana" description="Cambia el tamaño o vuelve a la distribución anterior.">
     <button type="button" onClick={onLayout}>Abrir distribución</button>
    </PreferenceRow>
    <p className="preference-hint">Estos controles se aplican al momento.</p>
    {immediateFeedback?.error&&<p role="alert">{immediateFeedback.text}</p>}
    <fieldset disabled={busy} className="preference-fieldset"><h3>Comportamiento</h3>
     {booleanRows(windowOptions.filter(([key])=>key!=='collapseOnBlur'||!status.workspace?.nativeCaption))}
    </fieldset>
    {saveBar}
   </div>}
   {category==='audio'&&<div className="preferences-page">
    <fieldset disabled={busy} className="preference-fieldset settings-interface-audio">
     <h3>Sonidos de interfaz</h3>
     <PreferenceSwitch title="Reproducir efectos de interfaz" description="Acompaña acciones como abrir o contraer la cápsula." checked={audioEnabled} onChange={value=>edit('interfaceSounds',value)}/>
     <PreferenceRow title="Volumen" controlId="interface-volume" description="Ajusta el volumen de los efectos de ZEN.">
      <div className="preference-range"><input id="interface-volume" type="range" min={0} max={100} value={draft.interfaceVolume} disabled={!audioEnabled}
       aria-valuetext={`${draft.interfaceVolume} %`} onChange={event=>edit('interfaceVolume',event.currentTarget.valueAsNumber)}/><output htmlFor="interface-volume">{draft.interfaceVolume} %</output></div>
      <button type="button" onClick={()=>interfaceAudio.preview(draft)} disabled={!audioEnabled||!draft.interfaceVolume||interfaceAudioMuted(draft)||interfaceAudioMuted(status.settings)}>Preescuchar</button>
     </PreferenceRow>
     <h3>Avisos y privacidad</h3>{booleanRows(noticeOptions)}
    </fieldset>
    <PreferenceRow title="Prueba y silencio temporal" description="Estas acciones usan los ajustes guardados.">
     <div className="preference-actions"><button type="button" onClick={()=>void testNotice()}>Probar aviso</button>{visible&&<Quiet status={status}/>}</div>
    </PreferenceRow>
    {immediateFeedback&&<p role={immediateFeedback.error?'alert':'status'}>{immediateFeedback.text}</p>}
    {saveBar}
   </div>}
   {category==='shortcuts'&&<div className="preferences-page">
    <fieldset disabled={busy} className="preference-fieldset">
     <h3>Combinaciones globales</h3>
     {shortcuts.map(([key,title])=><PreferenceRow key={key} title={title} controlId={key}>
      <input id={key} className="preference-shortcut" value={draft[key]} maxLength={80} spellCheck={false} onChange={event=>edit(key,event.currentTarget.value)}/>
     </PreferenceRow>)}
    </fieldset>
    <p className="preference-hint">Usa combinaciones distintas, por ejemplo Ctrl+Alt+Z.</p>
    {saveBar}
   </div>}
   {category==='data'&&<div className="preferences-page">
    <ProfileSyncSettings disabled={status.settings.presentation||status.settings.paused} onApplied={()=>{
     setChanges({});setFeedback({});setBackupRevision(value=>value+1);
     onBackupImported();
    }}/>
    <BackupSettings disabled={status.settings.presentation||status.settings.paused} onImported={()=>{
     setChanges({});setFeedback({});setBackupRevision(value=>value+1);
     onBackupImported();
    }}/>
    <div className="preferences-reset">
     <h3>Restablecer apariencia</h3>
     <PreferenceRow title="Valores iniciales del tema" description="Prepara el tema, el fondo y el cristal iniciales. Revisa el resultado en Apariencia antes de guardar.">
      <button type="button" disabled={status.settings.presentation} onClick={()=>{setRestoreAppearance(value=>value+1);select('appearance');}}>Preparar restablecimiento</button>
     </PreferenceRow>
    </div>
   </div>}
   {category==='connection'&&<ConnectionSettings status={status} visible={visible}/>}
  </section>
 </div>;
}

function ConnectionSettings({status,visible}:{status:CompanionStatus;visible:boolean}) {
 const [feedback,setFeedback]=useState<PreferenceFeedback>();
 const [busy,setBusy]=useState(false);

 async function run(action:()=>Promise<CompanionResult<unknown>>,success?:string) {
  setBusy(true);
  setFeedback(undefined);
  try{
   const result=await action();
   if(!result.ok)setFeedback({text:result.error,error:true});
   else if(success)setFeedback({text:success});
  }catch{setFeedback({text:'No se pudo completar el diagnóstico.',error:true});}
  finally{setBusy(false);}
 }

 return <div className="preferences-page connection-diagnosis">
  <div className="preference-connection-state"><span aria-hidden="true"/><div><strong>{connectionLabel(status)}</strong>
   {visible&&<Signal status={status}/>}</div></div>
  {status.targetError&&<p role="alert">{status.targetError}</p>}
  {status.error&&<p role="alert">{status.error}</p>}
  <PreferenceRow title="Cuenta" description={status.account==='chatgpt'?'ChatGPT detectado':status.account==='unchecked'?'Sin comprobar':'Revisar en Codex'}>
   <button type="button" disabled={busy||status.checking} onClick={()=>void run(()=>window.companion.check())}>{status.checking?'Comprobando…':'Comprobar conexión'}</button>
  </PreferenceRow>
  {status.target&&<PreferenceRow title="Chat fijado" description={status.target.title}><OpenCodex id={status.target.session}/></PreferenceRow>}
  {status.account==='missing'&&<p>Inicia sesión en Codex y vuelve a comprobar.</p>}
  {status.account==='unsupported'&&<p>La sesión comprobada usa otra cuenta. Revísala en Codex.</p>}
  <details className="settings-connection">
   <summary>Detalles técnicos</summary>
   <h3>{status.connection?.state==='review'?'Falta revisar los hooks':'Integración local con Codex'}</h3>
   {status.connection&&status.connection.total>0&&<p>{status.connection.trusted} de {status.connection.total} hooks revisados · {status.connection.enabled} habilitados.</p>}
   {(status.ignoredEvents??0)>0&&<p>{status.ignoredEvents} eventos ajenos al chat fijado descartados.</p>}
   {status.connection?.state==='ready'&&!status.lastEventAt&&<p>Los hooks están revisados y aún no han llegado eventos. Si Codex estaba abierto durante la instalación, vuelve a abrirlo y continúa el mismo chat.</p>}
   <div className="preference-actions">
    <button type="button" disabled={busy} onClick={()=>void run(()=>window.companion.install(),'Integración preparada. Revisa los hooks de ZEN con /hooks en Codex CLI.')}>
     {busy?'Procesando…':status.integration==='missing'?'Preparar integración':'Revisar instalación'}
    </button>
    <button type="button" disabled={busy} onClick={()=>void run(()=>window.companion.copy('/hooks'),'Comando copiado. Pégalo en Codex CLI para revisar los hooks.')}>Copiar /hooks</button>
   </div>
  </details>
  {feedback&&<p role={feedback.error?'alert':'status'}>{status.settings.presentation?'Detalles ocultos en Presentación.':feedback.text}</p>}
  <details className="companion-about"><summary><ZenEmblem/>Acerca de ZEN</summary><p>Incluye código MIT de Coucou · Louis Raillé. Iconos ZEN y tonos originales.</p></details>
 </div>;
}
