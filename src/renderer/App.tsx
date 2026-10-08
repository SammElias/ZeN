import {useConversations} from './useConversations';
import {Conversations} from './Conversations';
import type {ChatSnapshot,ChatDraft} from '../shared/conversations';
import {ContextTray,type SentContext} from './ContextTray';
import {GuideCard} from './GuideCard';
import {VisualExplanation} from './VisualExplanation';
import {useInteractions} from './useInteractions';
import {fileActions,SendGate,type VisualReference} from '../shared/interactions';
import './interactions.css';
import {CompanionContext} from './CompanionContext';
import {FloatingPet} from './FloatingPet';
import {usePetPresentation,presentedRobot} from './usePetPresentation';
import {effectiveMotion,explicitThanks} from '../shared/pet';
import './pet.css';
import {initialProjectContexts,type ProjectContexts} from '../shared/project-context';
import {HomePanel} from './HomePanel';
import {ProjectPicker} from './ProjectPicker';
import {ProjectContextsPanel} from './ProjectContextsPanel';
import './compact.css';
import {NavigationTabs} from './NavigationTabs';
import './navigation.css';
import {useDropContext} from './useDropContext';
import {WorkspacePanel} from './WorkspacePanel';
import {RegionPicker} from './RegionPicker';
import {taskStatus,type SelectionContext} from '../shared/workspace';
import {controlIntent} from '../shared/personal';
import './workspace.css';
import {computerRequest} from '../shared/computer';
import {confirmationAttempt,type HumanConfirmation} from '../shared/confirmation';
import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import type { ZenBridge, PublicSettings, TaskState, TaskEvent, DockEdge } from '../shared/contracts';
import type { VoiceStatus } from './voice';
import { LiveVoiceClient as VoiceClient } from './live-voice';
import { SuccessTimer } from './auto-hide';
import { audible, type ResponseMode } from '../shared/personal';
import { IconButton, Icon, VoiceIndicator, ApprovalCard } from './components';
import { latestTask, latestUtterance } from './latest-message';
import { MessageStore } from './message-store';
import { StreamingMessage } from './StreamingMessage';
import { ScreenContextChip } from './ScreenContextChip';
import { CAPSULE_HEIGHT } from '../shared/island';
import {robotPresentation} from '../shared/companion';
import './capsule.css';
import './companion.css';
import './robot.css';
import { Companion } from './Companion';
import {CapsuleHead} from './CapsuleHead';
import './head-capsule.css';
import './fullscreen.css';
import './chat-design.css';
import { useInterfaceSounds } from './interface-sounds';
import { ContextFlow, ProjectCard } from './ProjectCard';
import {isExternalCodexTask} from '../shared/project';
import { projectCreationRequest } from '../policy/project';
import { Composer } from './Composer';
import {ActivityStore,taskActivity} from './activity-store';
import {ActivityTimeline} from './ActivityTimeline';
import {activityLabels} from '../shared/activity';
import type { ScreenSnapshot } from '../main/screen-context';
import type {FolderAttachment} from '../main/folder-context';
declare global { interface Window { zen: ZenBridge; zenDemo?: boolean; demoState?: TaskEvent } }
const labels: Record<TaskState, string> = { idle: '¿Qué hacemos?', queued: 'En cola', listening: 'Te escucho', thinking: 'Preparando…', awaiting_approval: 'Necesito tu permiso', awaiting_input: 'Necesito contexto', executing: 'En marcha', completed: 'Listo', failed: 'Algo no ha salido bien', cancelled: 'Tarea detenida' };
export function App() {
  const [fullscreen,setFullscreen]=useState(false);const fullscreenRef=useRef(false);fullscreenRef.current=fullscreen;
  const [quick,setQuick]=useState(false),[actionsOpen,setActionsOpen]=useState(false),[visual,setVisual]=useState<VisualReference>(),[sentContext,setSentContext]=useState<SentContext>(),[sentVisual,setSentVisual]=useState<{image:string;reference:VisualReference}>();
  const quickRef=useRef(quick);quickRef.current=quick;
  const sendGate=useRef(new SendGate());
  const regionReturn=useRef<{quick:boolean;collapsed:boolean;page:'home'|'chat'|'tasks'}|undefined>(undefined);
  const regionSource=useRef<{source:string;capturedAt:number}>({source:'Pantalla de ZEN',capturedAt:Date.now()});
  const cancelRegion=()=>{setRegionImage(undefined);if(regionReturn.current){setQuick(regionReturn.current.quick);setCollapsed(regionReturn.current.collapsed);setPage(regionReturn.current.page);regionReturn.current=undefined;}};
  const closeQuick=()=>{setDraft({text:typedRef.current,stamp:Date.now()});setCollapsed(true);setQuick(false);};
  const [projects,setProjects]=useState<ProjectContexts>(initialProjectContexts),[projectsReady,setProjectsReady]=useState(false),[switchingProject,setSwitchingProject]=useState(false);
  const projectsRef=useRef(projects);projectsRef.current=projects;
  type ContextDraft={text:string;items:typeof drops.items;image?:string;visual?:VisualReference;folder?:FolderAttachment};
  const projectDrafts=useRef(new Map<string,ContextDraft>());
  const draftKey=()=> (projects.activeId??'general')+'/'+(replyTaskId??'draft');
  const rememberDraft=()=>projectDrafts.current.set(draftKey(),{text:typedRef.current,items:drops.items,image:selectedImage,visual,folder});
  const restoreDraft=(key:string)=>{const value=projectDrafts.current.get(key);drops.restore(value?.items??[]);setSelectedImage(value?.image);setVisual(value?.visual);setFolder(value?.folder);setTyped(value?.text??'');setDraft({text:value?.text??'',stamp:Date.now()});};
  const [panel,setPanel]=useState<'activity'|'context'|'projects'|'voice'|'permissions'|'notices'|null>(null);
  const panelRef=useRef<HTMLDivElement>(null),panelTrigger=useRef<HTMLElement|null>(null),chatScroll=useRef<HTMLDivElement>(null);
  const closePanel=()=>{setPanel(null);requestAnimationFrame(()=>panelTrigger.current?.focus({preventScroll:true}));};
  const openPanel=(next:typeof panel)=>{panelTrigger.current=document.activeElement as HTMLElement;setPanel(next);};
  useEffect(()=>{if(panel)panelRef.current?.querySelector<HTMLElement>('button,input')?.focus();},[panel]);
  const [composerImage,setComposerImage]=useState(false);
  const [page,setPage]=useState<'home'|'chat'|'tasks'>('chat');const pageRef=useRef(page);pageRef.current=page;
  const [workspaceOpen,setWorkspaceOpen]=useState(false),[regionImage,setRegionImage]=useState<string>(),[selection,setSelection]=useState<SelectionContext>(),[selectedImage,setSelectedImage]=useState<string>(),[draft,setDraft]=useState<{text:string;stamp:number}>(),[replyTaskId,setReplyTaskId]=useState<string>(),[typed,setTyped]=useState('');
  const typedRef=useRef(typed);typedRef.current=typed;
  const prepareDraft=(text:string,id?:string)=>{const saved=id?records.find(t=>t.id===id):undefined;if(saved?.chatId&&conversations.enabled){void conversations.open({action:'open',id:saved.chatId}).then(()=>{setPage('chat');setPanel(null);setCollapsed(false);if(text)setDraft({text,stamp:Date.now()});}).catch(e=>notify(e.message));return;}if(id&&id!==replyTaskId){rememberDraft();setSentContext(undefined);setSentVisual(undefined);setActionsOpen(false);void removeScreen();restoreDraft((projects.activeId??'general')+'/'+id);const row=records.find(t=>t.id===id);if(row){messages.reset();messages.task(row);setTask(row);setProjectTask(row.workContext?row:undefined);}}else if(text)setDraft({text,stamp:Date.now()});setPage('chat');setPanel(null);setWorkspaceOpen(false);setCollapsed(false);if(id)setReplyTaskId(id);};
  const acceptSelection=(value:SelectionContext)=>{void window.zen.dropText({text:value.text,link:false}).then(r=>{if(r.ok)drops.add([{...r.value,name:value.source}]);else notify(r.error);});};
  const chooseSelection=async(copied=false)=>{const r=await(copied?window.zen.clipboardContext():window.zen.selection());if(!r.ok)return notify(r.error);if(!r.value)return notify('Selecciona texto en la otra aplicación y usa el atajo de selección de Preferencias, o Texto copiado.');acceptSelection(r.value);};
  const chooseRegion=async()=>{regionReturn.current={quick,collapsed,page};await voice.current?.stop();if(!await refreshScreen()){cancelRegion();return;}const r=await window.zen.previewScreen();if(!r.ok||!r.value){const message=r.ok?'No hay captura disponible.':r.error;cancelRegion();setNotice(message);return;}regionSource.current={source:r.value.sourceTitle??'Pantalla de ZEN',capturedAt:r.value.capturedAt};setDraft({text:typedRef.current,stamp:Date.now()});setRegionImage(r.value.image);setQuick(false);setPage('chat');setCollapsed(false);setWorkspaceOpen(false);await window.zen.removeScreen();};
  const [systemReducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const a=window.zen.onSelection(acceptSelection),b=window.zen.onWorkspace(()=>{setDraft({text:typedRef.current,stamp:Date.now()});setPage('chat');setWorkspaceOpen(true);setCollapsed(false);}),c=window.zen.onReadResult(text=>{speechSynthesis.cancel();if(!text)return;const local=speechSynthesis.getVoices().filter(v=>v.localService),voice=local.find(v=>v.lang.startsWith('es'))??local[0];if(!voice)return notify('No hay una voz local instalada disponible.');const utterance=new SpeechSynthesisUtterance(text.slice(0,5000));utterance.voice=voice;utterance.lang=voice.lang;speechSynthesis.speak(utterance);});speechSynthesis.getVoices();const offRegion=window.zen.onRegion(image=>{regionReturn.current={quick:quickRef.current,collapsed:surfaceRef.current.collapsed,page:pageRef.current};regionSource.current={source:screenContextRef.current?.sourceTitle??'Pantalla · atajo de región',capturedAt:screenContextRef.current?.capturedAt??Date.now()};setQuick(false);setDraft({text:typedRef.current,stamp:Date.now()});setPage('chat');setCollapsed(false);setRegionImage(image);setWorkspaceOpen(false);});return()=>{a();b();c();offRegion();speechSynthesis.cancel();};},[]);
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [config, setConfig] = useState<PublicSettings>(); const configRef = useRef(config); configRef.current = config;
  const [responseMode, setResponseMode] = useState<ResponseMode>({ response: 'auto', meeting: false });
  const [observationId, setObservationId] = useState<string>();
  const [dockEdge, setDockEdge] = useState<DockEdge>('top');
  const [screenContext, setScreenContext] = useState<TaskEvent['screenContext']>();
  const screenContextRef=useRef(screenContext);screenContextRef.current=screenContext;
  const [screenPreview,setScreenPreview]=useState<ScreenSnapshot>();
  const previewDialog=useRef<HTMLDialogElement>(null);
  const manualMode=useRef(false);
  const awaitingLiveInput=useRef(false);
  const sendGeneration=useRef(0);
  const [folder,setFolder]=useState<FolderAttachment>();const choosingFolder=useRef(false);const folderRef=useRef(folder);folderRef.current=folder;
  const [projectTask,setProjectTask]=useState<TaskEvent>();
  const [projectFocus,setProjectFocus]=useState(false);
  const [liveRequest,setLiveRequest]=useState<{id:string;captionId:string;text:string}|null>(null);
  const [reviewRequest,setReviewRequest]=useState<typeof liveRequest>(null);
  const [confirmations,setConfirmations]=useState<HumanConfirmation[]>([]);const confirmationsRef=useRef(confirmations);confirmationsRef.current=confirmations;
  const [records, setRecords] = useState<TaskEvent[]>([]);
  const activities=useMemo(()=>{const store=new ActivityStore();if(window.demoState)store.accept(window.demoState);return store;},[]);
  const [preparations,setPreparations]=useState<string[]>([]);
  const messages = useMemo(() => new MessageStore(window.demoState ? latestTask({}, window.demoState) : {}), []);
  const projectMessages = useMemo(() => new MessageStore(), []);
  const messageMeta = useSyncExternalStore(messages.subscribeMetadata, messages.metadata);
  const streaming = JSON.parse(messageMeta)[2] as boolean;
  const [messageHeight, setMessageHeight] = useState(70);
  const measuredMessage = useCallback((height:number) => setMessageHeight(height), []);
  const [voiceNotice,setVoiceNotice] = useState('');
  const [task, setTask] = useState<TaskEvent>(window.demoState ?? { id: 'idle', state: 'idle', message: '' });
  const [soundTask,setSoundTask]=useState<TaskEvent>({id:'idle',state:'idle',message:''});
  const [voiceState, setVoiceState] = useState<VoiceStatus>('disconnected'); const [microphone, setMicrophone] = useState(false); const [speaking, setSpeaking] = useState(false);
  const microphoneRef=useRef(microphone);microphoneRef.current=microphone;
  const talkRefresh=useRef(false);
  const [pushToTalk, setPushToTalk] = useState(false); const pushToTalkRef = useRef(false); const held = useRef(false);
  const petMotion=effectiveMotion(config?.settings.petMotion??'system',systemReducedMotion,config?.settings.interfaceAnimations);
  const reducedMotion = petMotion==='reduced';
  const [visible, setVisible] = useState(true); const [collapsed, setCollapsed] = useState(true); const [interacting, setInteracting] = useState(false); const [notice, setNotice] = useState('');
  const surfaceRef=useRef({collapsed});surfaceRef.current={collapsed};
  const pet=usePetPresentation(config?.settings,visible);
  const playSound = useInterfaceSounds(!!config?.settings.interfaceSounds && !config?.settings.petSilent && audible(responseMode) && visible && voiceState === 'disconnected' && !microphone && !speaking, soundTask);
  const root = useRef<HTMLElement>(null); const voice = useRef<VoiceClient | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const liveDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(reviewRequest&&!liveDialog.current?.open)liveDialog.current?.showModal();},[reviewRequest]);
  const dragGesture = useRef<{ pointerId: number; x: number; y: number; capture: Element; moved: boolean } | undefined>(undefined);
  const suppressDragClick = useRef(false); const [dragging, setDragging] = useState(false);
  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    suppressDragClick.current = false;
    if (fullscreen || event.button !== 0 || target.closest('button:not(.brand-home),input,textarea,select,a,[role=dialog]')) return;
    setDragging(false);
    target.setPointerCapture(event.pointerId);
    dragGesture.current = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, capture: target, moved: false };
    void window.zen.drag('start').then(result => { if (!result.ok) { dragGesture.current = undefined; setDragging(false); } });
  };
  const updateDrag = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = dragGesture.current; if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (Math.hypot(event.screenX - gesture.x, event.screenY - gesture.y) >= 4) { gesture.moved = true; setDragging(true); }
  };
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = dragGesture.current; if (!gesture || gesture.pointerId !== event.pointerId) return;
    dragGesture.current = undefined; suppressDragClick.current = gesture.moved; setDragging(false);
    if (gesture.capture.hasPointerCapture(event.pointerId)) gesture.capture.releasePointerCapture(event.pointerId);
    void window.zen.drag('end');
  };
  const hideRef = useRef<() => void>(() => {}); const timer = useRef<SuccessTimer | null>(null);
  const notify = useCallback((message: string) => { setPage('chat');setCollapsed(false); setNotice(message); }, []);
  const drops=useDropContext({notify,expand:()=>{if(surfaceRef.current.collapsed)setQuick(true);setActionsOpen(true);setPage('chat');setCollapsed(false);},folder,onFolder:setFolder,onAttach:()=>{voice.current?.setMicrophoneEnabled(false);playSound('attach');}});
  const restoreChat=(value:ChatSnapshot)=>{
    ++sendGeneration.current;interactions.exit();setSentContext(undefined);setSentVisual(undefined);setVisual(undefined);setObservationId(undefined);setSelection(undefined);setFolder(undefined);setRegionImage(undefined);setScreenPreview(undefined);setReplyTaskId(undefined);setProjectTask(undefined);setProjectFocus(false);setLiveRequest(null);setReviewRequest(null);messages.reset();
    drops.restore(value.attachments.filter(a=>value.draft.attachmentIds.includes(a.id)));setSelectedImage(value.draft.image);setTyped(value.draft.text);setDraft({text:value.draft.text,stamp:Date.now()});
    const last=[...value.messages].reverse().find(m=>m.role==='assistant');const event=last?.event??{id:'idle',state:'idle' as const,message:''};setTask(event);setSoundTask({id:'idle',state:'idle',message:''});if(last?.event)messages.task({...last.event,message:last.text});
    if(value.draft.folderNotice)notify('Carpeta anterior: '+value.draft.folderNotice+'. Vuelve a elegirla antes de analizar.');
  };
  const chatDraft=useRef<ChatDraft>({text:'',attachmentIds:[],scrollTop:0});
  const conversations=useConversations(projects.activeId,projectsReady,restoreChat,notify,()=>({...chatDraft.current,scrollTop:chatScroll.current?.scrollTop??chatDraft.current.scrollTop}));
  chatDraft.current={text:typed,attachmentIds:drops.items.map(i=>i.id),image:selectedImage,scrollTop:chatScroll.current?.scrollTop??0,folderNotice:folder?.name};
  useEffect(()=>{if(conversations.enabled&&!conversations.loading&&conversations.active.current)conversations.save(chatDraft.current);},[typed,drops.items,selectedImage,folder,conversations.loading]);
  useEffect(()=>{const el=chatScroll.current;if(!el||!conversations.enabled)return;let timer:ReturnType<typeof setTimeout>;const save=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!conversations.loading)conversations.save({...chatDraft.current,scrollTop:el.scrollTop});},180);};el.addEventListener('scroll',save);return()=>{clearTimeout(timer);el.removeEventListener('scroll',save);};},[conversations.snapshot?.chat.id,conversations.loading]);

  const interactions=useInteractions(projects.activeId,records,notify);
  const interactionsRef=useRef(interactions);interactionsRef.current=interactions;
  const openQuick=()=>{setPanel(null);pet.dismiss();setQuick(true);setPage('chat');setCollapsed(false);setWorkspaceOpen(false);setDraft({text:typedRef.current,stamp:Date.now()});void window.zen.focusOverlay();if(configRef.current?.settings.resumeSuggestion)interactionsRef.current.offer();};
  const openGuide=()=>{setPage('chat');setPanel(null);setCollapsed(false);interactions.setSetup(true);};
  const fail = (message: string) => { setVoiceNotice(message); };
  async function hide() { drops.cancel();++sendGeneration.current;const hiding = window.zen.hide(); await voice.current?.stop(); const result = await hiding; if (!result.ok) fail(result.error); }
  hideRef.current = () => { void hide(); };
  const confirmVoice=()=>{void window.zen.liveConfirm().then(result=>{if(!result.ok)notify(result.error);else if(!result.value&&confirmationsRef.current.length)notify('Espera a ver «confirmo» y el código completo en la transcripción, y confirma al soltar o silenciar el micrófono.');});};
  const releaseTalk = (confirm=false) => { const wasHeld=held.current;held.current = false; if (pushToTalkRef.current) voice.current?.setMicrophoneEnabled(false);if(confirm&&wasHeld)confirmVoice(); };
  const cancelTalk=()=>releaseTalk();
  const refreshScreen=async()=>{const result=await window.zen.refreshScreen();if(!result.ok)notify(result.error);return result.ok&&result.value;};
  const automaticRefreshScreen=async()=>{if(screenContextRef.current?.state==='removed')return false;const result=await window.zen.refreshScreen(false);if(!result.ok)notify(result.error);return result.ok&&result.value;};
  const removeScreen=async()=>{++sendGeneration.current;const previous=screenContextRef.current;screenContextRef.current={state:'removed'};setScreenContext({state:'removed'});setScreenPreview(undefined);const result=await window.zen.removeScreen();if(!result.ok){setScreenContext(previous);notify(result.error);}};
  const resumeLiveInput=()=>{if(manualMode.current)awaitingLiveInput.current=true;manualMode.current=false;voice.current?.setMicrophoneEnabled(true);};
  const holdTalk = () => { if (pushToTalkRef.current && voice.current?.active) { held.current = true;if(confirmationsRef.current.length||folderRef.current){resumeLiveInput();return;}if(talkRefresh.current)return;talkRefresh.current=true;void automaticRefreshScreen().finally(()=>{talkRefresh.current=false;if(held.current&&pushToTalkRef.current&&voice.current?.active)resumeLiveInput();}); } };
  useEffect(() => {
    const caption=(event:Parameters<typeof latestUtterance>[1])=>{if(manualMode.current||awaitingLiveInput.current&&event.speaker==='zen')return;if(event.speaker==='user')awaitingLiveInput.current=false;messages.utterance(event);};
    voice.current = new VoiceClient(window.zen, (status, mic) => { if(status==='connecting'){manualMode.current=false;awaitingLiveInput.current=false;setVoiceNotice('');messages.startLive();}setVoiceState(status); setMicrophone(mic); }, fail, setSpeaking, caption);
    const applyMode = (mode: ResponseMode) => { setResponseMode(mode); voice.current?.setAudible(audible(mode)); };
    void window.zen.mode().then(result => { if (result.ok) applyMode(result.value); });
    const offMode = window.zen.onMode(applyMode);
    const offDock = window.zen.onDock(setDockEdge);
    void window.zen.dock().then(result => { if (result.ok) setDockEdge(result.value); });
    void Promise.all([window.zen.projectContexts(),window.zen.tasks()]).then(([contexts,result])=>{
      if(!contexts.ok){notify(contexts.error);return;}
      projectsRef.current=contexts.value;setProjects(contexts.value);setProjectsReady(true);
      if(result.ok){pet.tracker.hydrate(result.value);result.value.forEach(event=>activities.accept(event));setRecords(result.value);const last=result.value.filter(row=>!['voice','storage','control'].includes(row.id)&&(row.projectContextId??null)===contexts.value.activeId).at(-1);if(last){setTask(last);if(!messages.snapshot().message)messages.task(last);}}
    });
    void window.zen.settings().then(result => { if (result.ok) { setConfig(result.value); if (!result.value.shortcutRegistered) setNotice('Atajo ocupado. Puedes abrir ZEN desde la bandeja.');else if(result.value.regionShortcutRegistered===false||result.value.selectionShortcutRegistered===false)setNotice('Un atajo de captura está ocupado. Cámbialo en Preferencias; puedes usar el botón Recortar pantalla.'); } else fail(result.error); });
    const offConfirmations=window.zen.onConfirmations(setConfirmations);void window.zen.confirmations().then(result=>{if(result.ok)setConfirmations(result.value);});
    const offTask = window.zen.onTask(event => {
      if(event.preparation){const preparation=event.preparation;setPreparations(previous=>preparation.active?[...new Set([...previous,preparation.requestId])]:previous.filter(id=>id!==preparation.requestId));return;}
      if(!['voice','storage','control'].includes(event.id)&&((event.chatId&&event.chatId!==conversations.active.current)||(event.projectContextId??null)!==projectsRef.current.activeId)){setRecords(previous=>[...previous.filter(row=>row.id!==event.id),event].slice(-100));return;}
      pet.accept(event);
      activities.accept(event);
      if(event.workContext){projectMessages.task(event);setProjectTask(previous=>event.streamText&&previous?.id===event.id&&previous.state===event.state&&previous.workContext?.phase===event.workContext?.phase?previous:event);if((event.workContext.phase==='review'||event.workContext.phase==='external'&&!surfaceRef.current.collapsed)&&!microphoneRef.current){setProjectFocus(true);setCollapsed(false);}}
      if(event.screenContext){setScreenContext(event.screenContext);setScreenPreview(previous=>previous?.id===event.screenContext?.snapshotId?previous:undefined);return;}
      if(event.liveRequest!==undefined)setLiveRequest(event.liveRequest);
      if (event.contextConsumed) { setObservationId(undefined); return; }
      if (event.utterance) { caption(event.utterance);if(manualMode.current)return; if (event.utterance.phase === 'start'&&event.utterance.speaker==='user')setProjectFocus(false); return; }
      if(event.id==='voice'){if(['failed','cancelled'].includes(event.state)){setVoiceNotice(event.message);void voice.current?.stop();}return;}
      if (!['storage', 'control'].includes(event.id)) setRecords(previous => {const old=previous.find(row=>row.id===event.id);if(event.streamText&&old?.state===event.state&&old.workContext?.phase===event.workContext?.phase&&old.activity===event.activity)return previous;return old?previous.map(row=>row.id===event.id?{...row,...event}:row):[...previous,event].slice(-100);});
      messages.task(event);
      if(!['storage','control'].includes(event.id))setSoundTask(previous=>previous.id===event.id&&previous.state===event.state&&isExternalCodexTask(previous)===isExternalCodexTask(event)?previous:event);
      setTask(previous => event.streamText&&previous.id===event.id&&previous.state===event.state&&taskActivity(previous)===taskActivity(event)?previous:event);
      if (event.state === 'awaiting_approval') { setPage('chat');setCollapsed(false); }
      if (event.id === 'voice' && ['failed', 'cancelled'].includes(event.state)) void voice.current?.stop();
    });
    const offDeletedChat=window.zen.onConversation(event=>{if(event.deleted)setRecords(rows=>rows.filter(r=>r.chatId!==event.chatId&&!event.taskIds?.includes(r.id)));});
    const offSettings=window.zen.onSettingsChanged(setConfig);
    const offInvoke = window.zen.onInvoke(mode => { if(mode==='capsule')setFullscreen(false); if(mode!=='capsule'){pet.greet();setQuick(false);if(configRef.current?.settings.resumeSuggestion)interactionsRef.current.offer();} setVisible(true); setCollapsed(mode === 'capsule'); setNotice(''); const current = configRef.current; if (mode !== 'focus' && mode !== 'capsule' && !voice.current?.active && current?.hasKey && current.settings.voiceConsent && (mode === 'voice' || current.settings.listenOnInvoke)) void voice.current?.start(); });
    const offVisibility = window.zen.onVisibility(value => { setVisible(value); if (!value) { ++sendGeneration.current;setInteracting(false); void voice.current?.stop(); } });
    const keyboard = (event: KeyboardEvent) => { if(event.key==='F11'){event.preventDefault();if(!event.repeat){setPage('chat');setQuick(false);setCollapsed(false);setFullscreen(value=>!value);}return;} if (event.key === 'Escape' && (document.querySelector('dialog[open]')||event.defaultPrevented)) return; if (event.key === 'Escape' && root.current?.querySelector('.region-picker')) { event.preventDefault();cancelRegion();return;} if(event.key==='Escape'&&quickRef.current){event.preventDefault();closeQuick();return;} if (event.key === 'Escape'&&fullscreenRef.current){event.preventDefault();setFullscreen(false);return;} if (event.key === 'Escape') { releaseTalk(); event.preventDefault(); hideRef.current(); } if (event.code === 'Space' && event.ctrlKey && pushToTalkRef.current) { event.preventDefault(); holdTalk(); } };
    const releaseKey = (event: KeyboardEvent) => { if (event.code === 'Space' || event.key === 'Control') releaseTalk(true); };
    const refreshSettings = () => { void window.zen.settings().then(result => { if (result.ok) setConfig(result.value); }); };
    document.addEventListener('keyup', releaseKey); window.addEventListener('blur', cancelTalk); window.addEventListener('focus', refreshSettings);
    document.addEventListener('keydown', keyboard); timer.current = new SuccessTimer(() => hideRef.current());
    return () => { offDeletedChat();offSettings(); offConfirmations(); offDock(); offMode(); offTask(); offInvoke(); offVisibility(); document.removeEventListener('keydown', keyboard); document.removeEventListener('keyup', releaseKey); window.removeEventListener('blur', cancelTalk); window.removeEventListener('focus', refreshSettings); timer.current?.dispose(); messages.dispose(); projectMessages.dispose(); void voice.current?.stop(); };
  }, []);
  const pendingApprovals = records.filter(row => row.state === 'awaiting_approval'&&(row.projectContextId??null)===projects.activeId);
  const busy = preparations.length>0 || records.some(row => ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(row.state)) || ['queued', 'thinking', 'executing', 'awaiting_approval'].includes(task.state);
  const activityTask=projectFocus&&projectTask?projectTask:['queued','thinking','executing','awaiting_approval'].includes(task.state)?task:[...records].reverse().find(row=>['queued','thinking','executing','awaiting_approval'].includes(row.state))??task;
  const trail=useSyncExternalStore(activities.subscribe,()=>activities.get(activityTask.id));
  const currentActivity=trail?.steps.at(-1)?.activity??taskActivity(activityTask);
  const floating=collapsed&&!!config?.settings.showPetWhenFolded;
  const mode = floating?'pet':collapsed ? 'capsule' : fullscreen?'fullscreen':quick?'quick':'card';
  // A stable native surface; content reflows within it rather than resizing per delta.
  const desiredHeight=floating?390:collapsed?CAPSULE_HEIGHT:quick?480:560;
  useLayoutEffect(()=>{void window.zen.layout({mode,height:desiredHeight,reducedMotion});},[mode,desiredHeight,reducedMotion]);
  useEffect(() => { timer.current?.update({ enabled: config?.settings.autoHideSuccess ?? false, visible, state: task.state, voiceActive: voiceState !== 'disconnected' || speaking, interacting, hasCopyableResult: task.state === 'completed' && !!task.message, panelOpen: fullscreen || page!=='chat' || workspaceOpen || !!regionImage || !!screenPreview || !!reviewRequest }); }, [config, page, visible, task, voiceState, speaking, interacting,workspaceOpen,regionImage, screenPreview, reviewRequest,fullscreen]);
  async function stop() { setRegionImage(undefined);setObservationId(undefined);drops.clear();speechSynthesis.cancel();setSelection(undefined);setSelectedImage(undefined);setFolder(undefined);++sendGeneration.current;const stopping = window.zen.stop(); await voice.current?.stop(true); const result = await stopping; if (!result.ok) fail(result.error); else setNotice('Se solicitó detener. El estado de cada tarea confirmará la cancelación.'); }
  const toggleVoice = async () => { pushToTalkRef.current = false; setPushToTalk(false); held.current = false; if (voiceState === 'connected') {if(microphoneRef.current){voice.current?.setMicrophoneEnabled(false);confirmVoice();}else if(confirmationsRef.current.length||folderRef.current){resumeLiveInput();}else if(!talkRefresh.current){talkRefresh.current=true;try{await automaticRefreshScreen();if(voice.current?.active)resumeLiveInput();}finally{talkRefresh.current=false;}}} else if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa la conexión y el permiso en Preferencias desde la bandeja.'); } else if (!window.zenDemo) void voice.current?.start(); };
  const connectPushToTalk = async () => { if (!config?.hasKey || !config.settings.voiceConsent) { notify('Voz no disponible. Revisa Preferencias desde la bandeja.'); return; } pushToTalkRef.current = true; setPushToTalk(true); held.current = false; voice.current?.setMicrophoneEnabled(false); if (!window.zenDemo) await voice.current?.start(true); };
  const changeMode = async (next: ResponseMode) => { voice.current?.setAudible(audible(next)); setResponseMode(next); const result = await window.zen.setMode(next); if (!result.ok) fail(result.error); };
  const attention = pendingApprovals.length > 0 || (!isExternalCodexTask(task)&&['awaiting_approval', 'awaiting_input', 'failed'].includes(task.state));
  const activityStatus=currentActivity?activityLabels[currentActivity]:undefined;
  const rawStatus = task.paused?'En pausa':voiceState === 'connecting' ? 'Conectando…' : voiceState==='closing'?'Finalizando voz…': confirmations.length?'Esperando tu permiso': attention ? activityStatus?.short??'Te necesito' : speaking ? 'Respondiendo' : busy ? preparations.length?'Leyendo':activityStatus?.short??'Procesando' : microphone ? 'Escuchando' : responseMode.meeting ? 'Reunión' : activityStatus?.short??'Disponible';
  const [islandStatus,setIslandStatus]=useState(rawStatus);
  useEffect(()=>{if(attention||voiceState==='closing'||['completed','cancelled'].includes(activityTask.state)&&!speaking&&!microphone){setIslandStatus(rawStatus);return;}const timer=setTimeout(()=>setIslandStatus(rawStatus),300);return()=>clearTimeout(timer);},[rawStatus,attention,voiceState,activityTask.state,speaking,microphone]);
  const navigate = (_next?:null) => { setPanel(null);setQuick(false);setWorkspaceOpen(false);pet.greet();pet.dismiss();setPage('home');playSound('open');if(collapsed)void automaticRefreshScreen();setCollapsed(false);void window.zen.focusOverlay(); };
  const companionState:TaskState|'speaking' = islandStatus==='Respondiendo'?'speaking':islandStatus==='Escuchando'?'listening':attention?'awaiting_approval':busy?'thinking':'idle';
  const contextReady=!!(drops.items.length||selection||selectedImage||folder||screenContext?.state==='ready'),composing=!!typed.trim(),robotConfirmation=!!(pendingApprovals.length||confirmations.length);
  const realRobot=useMemo(()=>robotPresentation({state:activityTask.state,activity:currentActivity,busy,paused:activityTask.paused,confirmation:robotConfirmation,microphone,speaking,meeting:responseMode.meeting,contextReady,composing}),[activityTask.state,activityTask.paused,currentActivity,busy,robotConfirmation,microphone,speaking,responseMode.meeting,contextReady,composing]);
  const gestureBlocked=robotConfirmation||attention||busy||microphone||speaking||!!activityTask.paused;
  const robot=presentedRobot(realRobot,pet.gesture,gestureBlocked);
  const openPet=()=>{pet.dismiss();setPage('chat');void window.zen.openConversation();};
  useEffect(()=>{if(!visible||!microphone||reducedMotion)return;const interval=setInterval(()=>root.current?.style.setProperty('--input-level',String(voice.current?.level()??0)),80);return()=>{clearInterval(interval);root.current?.style.removeProperty('--input-level');};},[visible,microphone,reducedMotion]);
  const selectPage=(next:typeof page)=>{if(collapsed){void automaticRefreshScreen();void window.zen.focusOverlay();}if(next==='home'&&config?.settings.resumeSuggestion)interactions.offer();setQuick(false);setPage(next);setPanel(null);setWorkspaceOpen(false);setCollapsed(false);};
  useEffect(()=>{if(workspaceOpen){setPage('tasks');setWorkspaceOpen(false);setPanel(null);}},[workspaceOpen]);
  const fold = () => { setFullscreen(false); playSound(collapsed ? 'open' : 'close');if(collapsed){pet.greet();void automaticRefreshScreen();}else if(!floating){(root.current?.querySelector('.fold-button') as HTMLButtonElement)?.focus({preventScroll:true});} setCollapsed(value => !value); };
  const toggleFullscreen=()=>{if(!fullscreen)setPage('chat');setQuick(false);setCollapsed(false);setFullscreen(value=>!value);};
  const showScreenPreview=async()=>{const result=await window.zen.previewScreen();if(!result.ok)return notify(result.error);if(!result.value)return notify('La captura ya no está disponible. Actualiza la referencia.');setScreenPreview(result.value);};
  const chooseFolder=async()=>{if(drops.items.length)return notify('Quita los adjuntos antes de analizar una carpeta en Codex.');if(choosingFolder.current)return;choosingFolder.current=true;voice.current?.setMicrophoneEnabled(false);try{const result=await window.zen.chooseContextFolder();if(!result.ok)return notify(result.error);if(result.value){setFolder(result.value);playSound('attach');}}finally{choosingFolder.current=false;}};
  const removeFolder=()=>{if(folder)void window.zen.removeContextFolder(folder.id).then(result=>{if(!result.ok)notify(result.error);});setFolder(undefined);};
  useEffect(()=>{if(screenPreview&&!previewDialog.current?.open)previewDialog.current?.showModal();},[screenPreview]);
  const sendText=async(text:string,image?:string,guideGoal?:string)=>{
    if(conversations.enabled&&(conversations.loading||!conversations.active.current))throw new Error('Espera a que se cargue la conversación.');
    if(conversations.snapshot?.chat.archived)throw new Error('Recupera esta conversación antes de enviar.');
    if(!projectsReady||switchingProject)throw new Error('Espera a que se cargue el proyecto.');
    if(drops.preparing)throw new Error('Espera a que termine de preparar los adjuntos.');
    if(explicitThanks(text)&&!guideGoal&&!gestureBlocked&&!image&&!selectedImage&&!folder&&!drops.items.length){pet.perform('thanks');setTyped('');return;}
    const sourceChat=conversations.active.current;
    const confirming=!guideGoal&&confirmationAttempt(text),localControl=!guideGoal&&!!controlIntent(text),items=drops.items.map(item=>({...item})),sourceFolder=folder,sourceVisual=visual,sourceReply=replyTaskId,contextAt=visual?.capturedAt??items.find(item=>item.kind==='window')?.capturedAt??(image||selectedImage||items.some(item=>['image','window'].includes(item.kind))?Date.now():screenContext?.capturedAt);
    image=image??selectedImage;
    if(image&&items.some(item=>['image','window'].includes(item.kind)))throw new Error('Elige una sola referencia visual; quita la otra imagen o ventana antes de enviar.');
    const screenId=!confirming&&!localControl&&!image&&!observationId&&!items.length&&!sourceFolder&&['ready','queued'].includes(screenContext?.state??'')?screenContext?.snapshotId:undefined;
    const key=JSON.stringify([text,image,items.map(item=>item.id),observationId,screenId,sourceFolder?.id,sourceReply,guideGoal]);
    if(!sendGate.current.begin(key))throw new Error('Esta misma petición ya está en curso. Puedes ampliar o consultar su estado.');
    const generation=confirming||localControl?sendGeneration.current:++sendGeneration.current,requestId=crypto.randomUUID();let handedOff=false;
    try{
      let contextId=observationId;

      if(generation!==sendGeneration.current)throw new Error('Envío detenido antes de iniciar la tarea.');
      manualMode.current=true;voice.current?.setMicrophoneEnabled(false);if(voice.current?.active&&!confirming)void voice.current.interrupt();
      await conversations.flush();
      const pending=window.zen.run({chatId:sourceChat,imageData:confirming||localControl?undefined:image,text,requestId,projectContextId:projects.activeId,priority:2,observationId:confirming||localControl?undefined:contextId,folderId:confirming||localControl?undefined:sourceFolder?.id,replyTaskId:guideGoal||confirming||localControl?undefined:sourceReply,attachmentIds:confirming||localControl?undefined:items.map(item=>item.id),contextMode:'none',screenSnapshotId:screenId,visual:image?sourceVisual:undefined,interaction:guideGoal?'guide':undefined});
      handedOff=true;
      if(conversations.enabled&&!confirming&&!localControl){conversations.save({text:'',attachmentIds:[],scrollTop:chatScroll.current?.scrollHeight??0});drops.restore([]);setSelectedImage(undefined);setVisual(undefined);setFolder(undefined);void window.zen.removeScreen();}
      if(confirming||localControl){const result=await pending;if(!result.ok)throw new Error(result.error);notify(result.value.message);sendGate.current.end(key);return;}
      projectDrafts.current.delete(draftKey());interactions.clearSuggestion();setActionsOpen(false);pet.clear();pet.tracker.start(requestId);setTyped('');setDraft({text:'',stamp:Date.now()});setProjectFocus(false);messages.newRequest({speaker:'user',id:requestId,text,phase:'done'});setTask({id:requestId,interaction:guideGoal?'guide':undefined,state:'thinking',message:'Preparando…',request:text});setReplyTaskId(undefined);
      setSentContext({requestId,image:image??items.find(item=>item.preview?.startsWith('data:image/'))?.preview,names:[...items.map(item=>item.name),...(image?[sourceVisual?.source??'Imagen preparada']:[]),...(screenId?[screenContext?.sourceTitle??'Pantalla']:[]),...(sourceFolder?[sourceFolder.name]:[])],at:Date.now(),state:'sending'});
      setSentVisual(image&&sourceVisual?{image,reference:sourceVisual}:undefined);
      void pending.then(result=>{
        if(sourceChat&&sourceChat!==conversations.active.current)return;
        setSentContext(old=>old?.requestId===requestId?{...old,state:!result.ok||['failed','cancelled'].includes(result.value.state)?'failed':'sent'}:old);
        if(!result.ok){if(generation===sendGeneration.current){fail(result.error);setTask(previous=>({...previous,interaction:guideGoal?'guide':undefined,state:'failed',message:result.error,request:text}));}return;}
        if(guideGoal&&result.value.state==='completed')interactions.create(guideGoal,result.value.id,result.value.message,sourceVisual,contextAt);
        if(generation!==sendGeneration.current)return;
        messages.task({...result.value,request:text});setTask(previous=>previous.id===requestId?{...result.value,interaction:guideGoal?'guide':undefined,request:text}:previous);
      }).catch(error=>fail(error.message)).finally(()=>sendGate.current.end(key));
    }catch(error){sendGate.current.end(key);throw error;}finally{if(!handedOff)sendGate.current.end(key);}
  };

  const saveProjects=async(next:ProjectContexts)=>{
    if(switchingProject||drops.preparing)return false;
    setSwitchingProject(true);
    try{
      rememberDraft();await conversations.flush();
      await voice.current?.stop();
      const result=await window.zen.saveProjectContexts(next);if(!result.ok){notify(result.error);return false;}
      if(next.activeId!==projects.activeId){
        interactions.exit();setSentContext(undefined);setSentVisual(undefined);setVisual(undefined);setQuick(false);pet.clear();++sendGeneration.current;setPanel(null);
        const recovered=projectDrafts.current.get((next.activeId??'general')+'/draft');
        drops.restore(recovered?.items??[]);setFolder(recovered?.folder);setSelection(undefined);setObservationId(undefined);setSelectedImage(recovered?.image);setVisual(recovered?.visual);setRegionImage(undefined);setScreenPreview(undefined);setReplyTaskId(undefined);setProjectTask(undefined);setProjectFocus(false);setWorkspaceOpen(false);setNotice('');setLiveRequest(null);setReviewRequest(null);setSoundTask({id:'idle',state:'idle',message:''});
        setTyped(recovered?.text??'');setDraft({text:recovered?.text??'',stamp:Date.now()});
        messages.reset();projectMessages.reset();const last=records.filter(row=>!['voice','storage','control'].includes(row.id)&&(row.projectContextId??null)===next.activeId).at(-1);
        setTask(last??{id:'idle',state:'idle',message:''});setIslandStatus(last?(activityLabels[taskActivity(last)??'completed']?.short??'Disponible'):'Disponible');if(last)messages.task(last);
      }
      projectsRef.current=result.value;setProjects(result.value);return true;
    }finally{setSwitchingProject(false);}
  };


  const resumeCard=interactions.suggestion&&config?.settings.resumeSuggestion&&<section className="resume-card" aria-label="Retomar trabajo"><strong>Retomar</strong><p>{interactions.suggestion.guide?.goal??interactions.suggestion.task?.request??'Última tarea guardada'}</p><small>{interactions.suggestion.guide?({active:'Guía activa',paused:'Guía en pausa',completed:'Pasos completados por el usuario'}[interactions.suggestion.guide.status]):taskStatus(interactions.suggestion.task!)} · {(interactions.suggestion.guide?.updatedAt??interactions.suggestion.task?.updatedAt)?new Date(interactions.suggestion.guide?.updatedAt??interactions.suggestion.task!.updatedAt!).toLocaleString():'Fecha no disponible'}</small><div className="context-actions"><button onClick={()=>{const selected=interactions.suggestion!;if(selected.guide)interactions.openGuide(selected.guide.id);else if(selected.task){prepareDraft('',selected.task.id);setProjectTask(selected.task.workContext?selected.task:undefined);setProjectFocus(false);interactions.clearSuggestion();}setPage('chat');setNotice('Punto de lectura recuperado. Las referencias temporales anteriores no se recuperan: vuelve a adjuntarlas antes de una nueva petición.');}}>Continuar</button><button onClick={interactions.dismiss}>Descartar</button></div></section>;
  const contextCount=drops.items.length+(selectedImage?1:0)+(folder?1:0);
  const panelTitle=panel==='activity'?'Actividad':panel==='context'?'Contexto de la petición':panel==='projects'?'Gestionar proyectos':panel==='voice'?'Voz y reunión':panel==='notices'?'Avisos':'Permisos pendientes';
  const foreignActivity=!!(conversations.enabled&&activityTask.chatId&&activityTask.chatId!==conversations.active.current);
  const projectControl=<ProjectPicker value={projects} locked={!projectsReady||busy||switchingProject||drops.preparing||confirmations.length>0} select={id=>saveProjects({...projects,activeId:id})} manage={()=>openPanel('projects')}/>;
  const chatContents=<>
            {interactions.setup&&<form className="guide-setup" onSubmit={e=>{e.preventDefault();if(interactions.goal.trim())void sendText(interactions.goal,undefined,interactions.goal).then(()=>interactions.setSetup(false)).catch(e=>notify(e.message));}}><label>¿Qué quieres hacer paso a paso?<textarea autoFocus maxLength={2000} value={interactions.goal} onChange={e=>interactions.setGoal(e.target.value)}/></label><p>Usa el contexto seleccionado. Tú realizas y confirmas los pasos.</p><button disabled={busy||!interactions.goal.trim()}>Preparar guía</button><button type="button" onClick={()=>interactions.setSetup(false)}>Cerrar</button></form>}
            {interactions.guide&&!regionImage&&<GuideCard guide={interactions.guide} change={interactions.change} exit={interactions.exit} refresh={()=>{interactions.setGoal(interactions.guide!.goal);interactions.setSetup(true);void chooseRegion();}} reword={text=>{interactions.setGoal(text.slice(0,2000));interactions.setSetup(true);}}/>}
            {(!conversations.enabled||microphone||voiceState==='connected')&&<div className="conversation-pane"><StreamingMessage scrollParent={chatScroll} externalFollow={conversations.enabled} visualReference={sentVisual?.reference} store={messages} notify={notify} copyReady={!busy&&!speaking} visible={!collapsed&&page==='chat'&&!panel&&!regionImage} animated={visible&&!reducedMotion} measured={measuredMessage} robot={robot}/></div>}
            {actionsOpen&&drops.items.length>0&&<section className="file-actions" aria-label="Acciones del contexto"><strong>¿Qué hacemos con estos archivos?</strong><div className="context-actions">{fileActions(drops.items.map(item=>item.name)).map(action=><button key={action} onClick={()=>{if(action==='Preguntar'){setActionsOpen(false);setDraft({text:typedRef.current,stamp:Date.now()});return;}const prompt=action==='Revisar código'?'Revisa el código adjunto. Explica errores y mejoras sin ejecutarlo.':(action==='Resumir'?'Resume':action==='Explicar'?'Explica':'Extrae los datos de')+' los adjuntos seleccionados.';void sendText(prompt).catch(e=>notify(e.message));}}>{action}</button>)}</div></section>}
            {task.state==='failed'&&task.request&&<button onClick={()=>{if(task.interaction==='guide'){interactions.setGoal(task.request!);interactions.setSetup(true);}else setDraft({text:task.request!,stamp:Date.now()});notify('Revisa el contexto y pulsa Enviar para volver a intentarlo. No se repiten acciones automáticamente.');}}>Revisar y reintentar</button>}
            {sentVisual&&<VisualExplanation image={sentVisual.image} reference={sentVisual.reference} text={task.message}/>}

  </>;
  return <CompanionContext.Provider value={{presentation:robot,animated:visible&&!reducedMotion,motion:petMotion,gesture:gestureBlocked?null:pet.gesture,greet:()=>{if(!gestureBlocked)pet.perform('wave');},drop:drops.active,accessory:config?.settings.petAccessory}}><main ref={root} {...drops.handlers} style={{height:collapsed&&!floating?CAPSULE_HEIGHT:'100dvh'}} className={`zen-overlay island live-only ${!collapsed?'compact-shell head-shell':'head-shell'} ${drops.active?'drop-ready':''} ${mode} pet-motion-${petMotion} dock-${dockEdge} ${attention ? 'attention' : busy ? 'working' : 'calm'} ${microphone || speaking ? 'glow' : ''} ${visible ? 'visible' : 'hidden'} ${reducedMotion ? 'motion-off' : ''}`} data-mood={companionState} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(document.hasFocus() || !!getSelection()?.toString())} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }} aria-label="ZEN asistente" onKeyDown={event=>{if(event.key==='Escape'&&panel){event.preventDefault();event.stopPropagation();closePanel();}}}>
    {!collapsed&&drops.active&&<div className="drop-target-hint"><strong>{drops.label}</strong><span>Ventanas, archivos, imágenes, texto o enlaces. Se revisa antes de enviar.</span></div>}
    {floating?<FloatingPet presentation={robot} size={config?.settings.petSize??96} animated={visible&&!reducedMotion} bubbles={config?.settings.petBubbles??true} silent={!!config?.settings.petSilent||responseMode.meeting||!audible(responseMode)} critical={attention||robotConfirmation} microphone={microphone} completion={gestureBlocked?null:pet.completion} home={()=>navigate(null)} open={openPet} quick={openQuick} guide={openGuide} attach={()=>void drops.pick()} region={()=>void chooseRegion()} voice={()=>{openPet();void toggleVoice();}} tasks={()=>{openPet();setPage('tasks');}}  hide={()=>void hide()} dismissCompletion={pet.dismiss}/>:quick?<header className="quick-header"><Companion state={companionState} pose={robot.pose} animated={visible&&!reducedMotion}/><div><strong>Pregunta rápida</strong><small role="status">{islandStatus}</small></div><button aria-label="Ampliar al chat" onClick={()=>{setQuick(false);void window.zen.focusOverlay();}}>↗</button><button aria-label="Cerrar tarjeta rápida" onClick={closeQuick}>×</button></header>:<header className={`overlay-header ${dragging ? 'dragging' : ''}`} title={fullscreen?'ZEN · pantalla completa':'Arrastra al borde superior, izquierdo o derecho'} onPointerDown={beginDrag} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onClickCapture={event => { if (suppressDragClick.current) { event.preventDefault(); event.stopPropagation(); suppressDragClick.current = false; } }}>
      <div className={`navigation-dock ${collapsed?'compact':''}`}>
        <button className="brand-home" onClick={() => navigate(null)} aria-label="Inicio de ZEN" title="ZEN · abrir Inicio y arrastrar"><CapsuleHead state={companionState} permissionKey={[...confirmations.map(row=>row.key+':'+row.code),...pendingApprovals.map(row=>row.approval?.id??row.id)].sort().join('|')} canReceive={!folder&&drops.items.length<8} enabled={visible&&!config?.settings.petSilent} blocked={gestureBlocked}/><span className="brand">ZEN</span></button>
        <NavigationTabs page={page} select={selectPage}/>
      </div>

      <button type="button" onClick={()=>{setQuick(false);setCollapsed(false);openPanel(robotConfirmation||liveRequest?'permissions':'activity');}} aria-label={`Estado: ${islandStatus}. ${robotConfirmation||liveRequest?'Revisar permiso':'Ver actividad'}`} className={`header-status ${busy || speaking ? 'working' : ''}`} title={voiceNotice||islandStatus}><i /><span className="status-symbol-compact"><Icon name={robotConfirmation||liveRequest?'error':microphone?'mic':busy?'settings':isExternalCodexTask(activityTask)?'send':'check'}/></span><span className="status-label">{drops.active?drops.preparing?'Preparando…':'Suelta aquí':islandStatus}</span></button>
      {<IconButton name={microphone ? 'mic' : 'mute'} label={microphone ? 'Micrófono activo · silenciar' : voiceState==='closing'?'Finalizando voz': voiceState === 'connected' ? 'Micrófono silenciado · activar' : 'Micrófono apagado · comenzar voz'} className={`icon-button island-microphone ${microphone ? 'active' : ''}`} aria-pressed={microphone} disabled={voiceState === 'connecting'||voiceState==='closing'} onClick={toggleVoice} />}{microphone&&<VoiceIndicator active compact visible={visible} client={voice}/>}
      <div className="header-actions">{!collapsed&&<IconButton name={fullscreen?'restore':'expand'} label={fullscreen?'Salir de pantalla completa (F11 o Esc)':'Pantalla completa (F11)'} aria-pressed={fullscreen} onClick={toggleFullscreen}/>}<button title={collapsed?'Desplegar panel':'Recoger panel'} className="fold-button" onClick={fold} aria-expanded={!collapsed} aria-label={collapsed ? 'Desplegar panel' : 'Recoger panel'}><svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: collapsed ? undefined : 'rotate(180deg)' }}><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg></button>{(busy||confirmations.length>0||microphone||voiceState!=='disconnected') ? <IconButton name="stop" label="Detener todas las tareas" className="icon-button danger" onClick={() => void stop()} /> : null}<IconButton name="close" label={fullscreen?'Ocultar ZEN':'Ocultar ZEN (Esc)'} onClick={() => void hide()} /></div>
    </header>}

    <div className="expanded-content" hidden={collapsed}>
      <div className="main-region">{!(page==='chat'&&conversations.enabled)&&<div className="project-bar">{projectControl}</div>}
        {(busy||confirmations.length>0||pendingApprovals.length>0||liveRequest||microphone||voiceState!=='disconnected'||(page!=='chat'||!conversations.enabled)&&trail)&&<div className="content-toolbar"><span role="status" className={foreignActivity?'execution-origin':undefined} title={foreignActivity?activityTask.request:undefined}>{foreignActivity?`Otra conversación · ${activityTask.request??'Tarea en curso'}`:islandStatus}</span>{trail&&<button className="activity-open" onClick={()=>openPanel('activity')}>Actividad <small>{trail.steps.length}</small></button>}{(confirmations.length>0||pendingApprovals.length>0||liveRequest)&&<button className="permission-open" onClick={()=>openPanel('permissions')}>Revisar permiso</button>}{busy&&<button onClick={()=>void window.zen.taskControl(task.paused?'resume':'pause').then(r=>{if(!r.ok)notify(r.error);})}>{task.paused?'Continuar':'Pausar'}</button>}{(busy||microphone||voiceState!=='disconnected'||confirmations.length>0)&&<button className="danger" onClick={()=>void stop()}>Detener</button>}</div>}
        <div className="view-region" hidden={!!panel||!!regionImage}>
          <div className="view home-view" hidden={page!=='home'}><HomePanel analyze={()=>{prepareDraft('Analiza esta captura y ayúdame con lo que aparece en pantalla.');void refreshScreen();}} explain={()=>prepareDraft('Explica este contexto y ayúdame a entenderlo.')} guide={openGuide} animated={visible&&!reducedMotion} resume={resumeCard}/></div>
          <div className="view tasks-view" hidden={page!=='tasks'}><WorkspacePanel use={prepareDraft} notify={notify} tasks={records} draft={typed} resume={resumeCard} projects={projects} review={()=>openPanel('permissions')} stop={()=>void stop()}/></div>
          <div className="view chat-page" hidden={page!=='chat'}>{conversations.enabled?<Conversations snapshot={conversations.snapshot} revision={conversations.revision} loading={conversations.loading} projects={projects} call={conversations.call} open={async c=>{if(drops.preparing)throw new Error("Espera a que terminen los adjuntos.");await conversations.open(c);}} refresh={conversations.refresh} restore={s=>{drops.restore(s.attachments.filter(a=>s.draft.attachmentIds.includes(a.id)));void conversations.refresh();}} notify={notify} scroll={chatScroll} projectControl={projectControl} activityControl={<button onClick={e=>{const menu=e.currentTarget.closest('details');if(menu)menu.open=false;openPanel('activity');}}>{foreignActivity?'Actividad de otra conversación':activityTask.chatId?'Actividad del chat':'Actividad de ZEN'}</button>}>{chatContents}</Conversations>:<div className="chat-scroll-content content-scroll" ref={chatScroll} tabIndex={0} aria-label="Conversación">{chatContents}</div>}</div>
        </div>
        {regionImage&&<div className="view region-view"><RegionPicker image={regionImage} source={regionSource.current.source} capturedAt={regionSource.current.capturedAt} cancel={cancelRegion} done={(value,reference,question)=>{setSelectedImage(value);setVisual(reference);setSelection(undefined);setObservationId(undefined);setRegionImage(undefined);if(regionReturn.current?.quick)setQuick(true);regionReturn.current=undefined;if(question)setDraft({text:question,stamp:Date.now()});}}/></div>}
        {panel&&<div className="view detail-panel" ref={panelRef} aria-label={panelTitle}><div className="panel-heading"><h2>{panelTitle}</h2><button onClick={closePanel} aria-label="Volver a la conversación">Volver <span aria-hidden="true">×</span></button></div><div className="panel-content content-scroll">
          {panel==='activity'&&<>{trail&&<ActivityTimeline trail={trail} animated={visible&&!reducedMotion} expanded toggle={closePanel} paused={activityTask.paused}/ >}{projectTask?.workContext&&<><button onClick={()=>setProjectFocus(v=>!v)}>{projectFocus?'Cerrar detalle de Codex':'Ver detalle de Codex'}</button>{projectFocus&&(projectTask.workContext.phase==='review'&&projectTask.workContext.draft?<ProjectCard key={projectTask.workContext.draft.id} draft={projectTask.workContext.draft} notify={notify} changed={draft=>setProjectTask(previous=>previous?{...previous,workContext:{owner:'codex',phase:'review',draft}}:previous)}/>:<p className="result-text">{projectTask.message}</p>)}</>}</>}
          {panel==='context'&&<>{folder&&<div className="context-row"><div><strong>{folder.name}</strong><p>{folder.label}</p><small>Analizar en Codex del escritorio</small></div><button onClick={removeFolder}>Quitar carpeta</button></div>}<ContextTray items={drops.items} remove={drops.remove} edit={drops.edit} preparing={drops.preparing} cancel={drops.cancel} error={drops.error} clearError={drops.clearError} image={selectedImage} visual={visual} removeImage={()=>{setSelectedImage(undefined);setVisual(undefined);setObservationId(undefined);}} sent={sentContext}/></>}
          {panel==='projects'&&<ProjectContextsPanel value={projects} save={saveProjects} notify={notify} locked={busy||switchingProject||confirmations.length>0}/>}
          {panel==='permissions'&&<>{!!pendingApprovals.length&&<div className="approval-stack">{pendingApprovals.map(row=><ApprovalCard key={row.id} simulated={!!window.zenDemo} approval={row.approval} notify={notify}/>)}</div>}{!!confirmations.length&&<aside className="human-confirmations" aria-label="Confirmaciones por voz o chat">{confirmations.map(row=><p key={row.key}><strong>{row.label}</strong>{row.preview&&<button onClick={()=>setScreenPreview({id:row.key,image:row.preview!,capturedAt:row.expiresAt-300000,sourceTitle:"Bloque visual propuesto",scope:"window"})}>Ver pantalla revisada</button>}<span>Di o escribe «confirmo {row.code.split('').join(' ')}». En voz, suelta pulsar para hablar o silencia el micrófono al terminar.</span></p>)}</aside>}{liveRequest&&!microphone&&<button className="source-chip" onClick={()=>{voice.current?.setMicrophoneEnabled(false);setReviewRequest(liveRequest);}}>{projectCreationRequest(liveRequest.text)?'Preparar con Codex':'Revisar petición para las herramientas de ZEN'}</button>}{!pendingApprovals.length&&!confirmations.length&&!liveRequest&&<p>No hay permisos pendientes.</p>}</>}
          {panel==='notices'&&<div role="status">{notice&&<p>{notice}</p>}{voiceNotice&&<p>{voiceNotice}</p>}</div>}
          {panel==='voice'&&<footer className={`execution-controls ${microphone?'listening':speaking?'speaking':voiceState==='connecting'?'connecting':'off'}`} aria-label="Controles de voz"><div className="microphone-group"><button className={`voice-toggle ${microphone?'active':''}`} aria-label={microphone?'Micrófono activo · silenciar':'Micrófono apagado · comenzar voz'} aria-pressed={microphone} disabled={voiceState==='connecting'||voiceState==='closing'} onClick={toggleVoice}><Icon name={microphone?'mic':'mute'}/><span><i className={microphone ? 'mic-dot active' : 'mic-dot'} />{microphone && <VoiceIndicator active visible={visible} client={voice} />}{voiceState==='connecting'?'Conectando…':voiceState==='closing'?'Finalizando voz…':microphone?'Escuchando':speaking?'Respondiendo':voiceState==='connected'?'Micrófono silenciado':'Micrófono apagado'}</span></button>{voiceNotice&&<span className="voice-notice" role="status" title={voiceNotice}>{voiceNotice}<button aria-label="Cerrar aviso de voz" onClick={()=>setVoiceNotice('')}>×</button></span>}</div><div className="execution-actions">{!pushToTalk || voiceState === 'disconnected' ? <button onClick={() => void connectPushToTalk()}>Pulsar para hablar</button> : <button disabled={voiceState !== 'connected'} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); holdTalk(); }} onPointerUp={()=>releaseTalk(true)} onPointerCancel={cancelTalk} onLostPointerCapture={cancelTalk} onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();holdTalk();}}} onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();releaseTalk(true);}}} onBlur={cancelTalk}>Mantén · Ctrl+Espacio</button>}<button className={responseMode.meeting ? 'meeting-active' : ''} aria-pressed={responseMode.meeting} onClick={() => void changeMode({ response: responseMode.response, meeting: !responseMode.meeting })}>{responseMode.meeting ? 'En reunión' : 'Modo reunión'}</button>{speaking && <button onClick={() => void changeMode({ ...responseMode, response: 'text' })}>Silenciar respuesta</button>}{voiceState !== 'disconnected' && <button onClick={() => void voice.current?.stop()}>Desconectar</button>}{busy && <button className="danger" onClick={() => void stop()}><Icon name="stop" />Detener</button>}</div></footer>}
        </div></div>}
      </div>
      <div className="composer-shell"><div className="composer-block">
        {(notice||voiceNotice)&&panel!=='notices'&&<div className="compact-notice"><button className="notice-detail" onClick={()=>openPanel('notices')} title={notice||voiceNotice}><span role="status">{notice||voiceNotice}</span><small>Ver aviso</small></button><button aria-label="Cerrar aviso" onClick={()=>{setNotice('');setVoiceNotice('');}}>×</button></div>}

        {replyTaskId&&<div className="resume-note">Conversación retomada<button onClick={()=>{rememberDraft();setReplyTaskId(undefined);restoreDraft((projects.activeId??'general')+'/draft');}}>Salir</button></div>}
        {(contextCount>0||drops.preparing||drops.error)&&<div className="context-summary"><button aria-label="Revisar contexto adjunto" onClick={()=>openPanel('context')}><Icon name="attach"/><span>{drops.preparing?'Preparando contexto…':drops.error?'Revisar adjuntos':contextCount>0?(contextCount===1?(drops.items[0]?`${({file:'Archivo',window:'Ventana',image:'Imagen',link:'Enlace',text:'Texto'} as const)[drops.items[0].kind]}: ${drops.items[0].name}`:folder?`Carpeta: ${folder.name}`:visual?.source??'Imagen preparada'):contextCount+' adjuntos'):(sentContext?.names.length?'Contexto enviado':screenContext?.sourceTitle??'Captura preparada')}</span></button>{contextCount===1&&<button aria-label="Quitar contexto adjunto" onClick={()=>{if(drops.items.length)drops.remove(drops.items[0].id);else if(folder)removeFolder();else{setSelectedImage(undefined);setVisual(undefined);}}}>×</button>}</div>}
        {conversations.snapshot?.transfers.filter(t=>t.active).map(t=><details className="context-tag" key={t.id}><summary>Contexto de: {t.sourceTitle}</summary><div><p>{t.text}</p><button onClick={()=>void conversations.call({action:'detach',id:conversations.snapshot!.chat.id,transferId:t.id}).then(()=>conversations.refresh()).catch(e=>notify(e.message))}>Quitar contexto de futuras peticiones</button></div></details>)}
        <ScreenContextChip compact context={screenContext} refresh={refreshScreen} preview={showScreenPreview} remove={removeScreen} disabledReason={contextCount||selection||observationId?'Quita el contexto adjunto para usar la captura de pantalla':switchingProject||drops.preparing?'Espera a que termine de preparar el contexto':undefined}/>
        <Composer visible={!collapsed} voiceControl={<div className="composer-voice">{quick&&<button type="button" aria-label={microphone?'Micrófono activo · silenciar':'Micrófono apagado · comenzar voz'} title={microphone?'Silenciar micrófono':'Comenzar voz'} aria-pressed={microphone} disabled={voiceState==='connecting'||voiceState==='closing'} onClick={toggleVoice}><Icon name={microphone?'mic':'mute'}/></button>}<button type="button" aria-label="Opciones de voz y reunión" title="Opciones de voz y reunión" onClick={()=>openPanel('voice')}><Icon name="settings"/></button></div>} guide={openGuide} imageValue={selectedImage} imageChanged={value=>{setSelectedImage(value);setVisual(undefined);}} attachFiles={()=>void drops.pick()} key={conversations.active.current??(projects.activeId??'general')+'/'+(replyTaskId??'draft')} attachmentChanged={setComposerImage} contextAttached={drops.items.length>0||!!selectedImage} preparingContext={drops.preparing} draft={draft} changed={setTyped} clipboard={()=>void chooseSelection(true)} selection={()=>void chooseSelection()} region={()=>void chooseRegion()} send={async(text,image)=>{await sendText(text,image);setPage('chat');setPanel(null);}} notify={notify} refresh={refreshScreen} chooseFolder={chooseFolder} folder={folder} removeFolder={removeFolder}/>
        {(microphone||voiceState==='connecting'||voiceState==='closing'||responseMode.meeting)&&<div className="voice-active-status" role="status">{microphone?<><VoiceIndicator active visible={visible} client={voice}/> Micrófono activo</>:voiceState==='connecting'?'Conectando voz…':voiceState==='closing'?'Finalizando voz…':'Modo reunión · respuesta en texto'}</div>}
      </div></div>
      {reviewRequest&&<dialog ref={liveDialog} className="chat-context" aria-label="Revisar petición a las herramientas" onCancel={()=>setReviewRequest(null)}><div className="context-heading"><strong>{projectCreationRequest(reviewRequest.text)?'Pasemos tu idea a Codex':'Esta petición usará las herramientas de ZEN'}</strong><IconButton name="close" label="Cerrar revisión" onClick={()=>setReviewRequest(null)} /></div><p className="result-text">{reviewRequest.text}</p><button className="primary" disabled={reviewRequest.id!==liveRequest?.id} onClick={()=>{const id=reviewRequest.id;setReviewRequest(null);setLiveRequest(null);void window.zen.liveSubmit(id).then(result=>{if(!result.ok)notify(result.error);});}}>{projectCreationRequest(reviewRequest.text)?'Preparar mi proyecto':'Ejecutar esta petición'}</button>{reviewRequest.id!==liveRequest?.id&&<p>La transcripción ha cambiado. Cierra y revisa la petición actual.</p>}</dialog>}
      {screenPreview&&<dialog ref={previewDialog} className="screen-preview" aria-label="Captura usada como contexto" onCancel={()=>setScreenPreview(undefined)}><div className="context-heading"><strong>Esta es la captura de referencia</strong><IconButton name="close" label="Cerrar captura de referencia" onClick={()=>setScreenPreview(undefined)}/></div><p>{screenPreview.scope==='display'?'Pantalla donde está ZEN':'Referencia visual'} · {screenPreview.sourceTitle} · {new Date(screenPreview.capturedAt).toLocaleTimeString()}</p><img src={screenPreview.image} alt="Captura exacta preparada para SOL"/></dialog>}
    </div>
  </main></CompanionContext.Provider>;
}
