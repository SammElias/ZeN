import React,{useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ClipboardList,Copy,Plus,Save,Send,Sparkles,Trash2} from 'lucide-react';
import {
  DiscoveryFields,discoveryAssessment,discoveryBrief,discoveryGroups,discoveryIdea,discoveryLimits,discoveryOutcome,discoveryQuestions,
  type DiscoveryQuestionId,type DiscoveryRecord,
} from '../shared/app-discovery';
import type {HubAction,HubData} from '../shared/knowledge-hub';
import './DiscoveryWorkspace.css';

type Draft = {fields:DiscoveryFields; id?:string; expected?:number};
type Confirmation = {text:string;label:string;run:()=>void};
type Props = {
  visible:boolean;
  records:DiscoveryRecord[];
  busy:boolean;
  mutate:(action:HubAction,done?:(data:HubData,id?:string)=>void)=>Promise<void>;
  confirm:(value:Confirmation)=>void;
  onAssess:(text:string)=>Promise<void>;
};

const empty=():Draft=>({fields:{title:'',answers:{}}});

function edit(record:DiscoveryRecord):Draft {
  const {id,updatedAt,...fields}=record;
  return {id,expected:updatedAt,fields};
}

export function DiscoveryWorkspace({visible,records,busy,mutate,confirm,onAssess}:Props) {
  const [draft,setDraft]=useState<Draft>();
  const [baseline,setBaseline]=useState('');
  const [step,setStep]=useState(0);
  const [showDetails,setShowDetails]=useState(false);
  const [showIdea,setShowIdea]=useState(false);
  const [preparing,setPreparing]=useState(false);
  const [feedback,setFeedback]=useState<{text:string;error?:boolean}>();
  const root=useRef<HTMLElement>(null);
  const ideaHeading=useRef<HTMLHeadingElement>(null);
  const fields=draft?.fields;
  const dirty=Boolean(fields&&JSON.stringify(fields)!==baseline);
  const locked=busy||preparing;
  const group=discoveryGroups[step];
  const valid=DiscoveryFields.safeParse(fields);
  const ready=valid.success&&Boolean(discoveryOutcome(valid.data));
  const idea=ready&&showIdea?discoveryIdea(valid.data):undefined;
  const essential=discoveryQuestions.filter(item=>!item.detail);
  const answered=essential.filter(item=>{
    const answer=fields?.answers[item.id];
    return answer?.text.trim()&&!answer.pending;
  }).length;

  function open(next?:Draft) {
    setDraft(next);
    setBaseline(next?JSON.stringify(next.fields):'');
    setStep(0);setShowDetails(discoveryQuestions.some(item=>item.detail&&next?.fields.answers[item.id]));setShowIdea(false);setFeedback(undefined);
    if(root.current)root.current.scrollTop=0;
  }

  function back() {
    if(dirty) confirm({text:'¿Volver a las fichas? Los cambios sin guardar se perderán.',label:'Volver a las fichas',run:()=>open()});
    else open();
  }

  function updateAnswer(id:DiscoveryQuestionId,update:{text?:string;pending?:boolean}) {
    setDraft(current=>current&&{
      ...current,fields:{...current.fields,answers:{
        ...current.fields.answers,[id]:{text:'',pending:false,...current.fields.answers[id],...update},
      }},
    });
  }

  async function persist(current:Draft,values:DiscoveryFields) {
    setFeedback(undefined);
    let stored=false;
    await mutate({type:'saveDiscovery',id:current.id,expected:current.expected,fields:values},(data,id)=>{
      const record=data.discoveries?.find(item=>item.id===id);
      if(!record)return;
      const saved=edit(record);
      setDraft(saved);
      setBaseline(JSON.stringify(saved.fields));
      setFeedback({text:'Ficha guardada.'});
      stored=true;
    });
    return stored;
  }

  async function prepare() {
    if(!draft||!valid.success||!ready||locked)return;
    setPreparing(true);setFeedback(undefined);
    try {
      if(dirty&&!(await persist(draft,valid.data)))return;
      await onAssess(discoveryAssessment(valid.data));
    }
    catch(error){setFeedback({text:error instanceof Error?error.message:'No se pudo preparar la valoración.',error:true});}
    finally{setPreparing(false);}
  }

  function showProposal() {
    setShowIdea(true);
    requestAnimationFrame(()=>ideaHeading.current?.focus());
  }

  return <section ref={root} className="discovery-workspace" hidden={!visible} inert={!visible} aria-label="Fichas de descubrimiento">
    {!draft ? <>
      <div className="discovery-toolbar">
        <p className="hub-muted">Entrevistas y valoraciones para nuevas aplicaciones.</p>
        <button type="button" className="hub-primary" disabled={locked} onClick={()=>open(empty())}><Plus size={16}/>Nueva ficha</button>
      </div>
      {records.length===0?<div className="hub-panel discovery-empty">
        <ClipboardList size={22}/><p>Aún no tienes fichas de descubrimiento.</p>
      </div>:<ul className="discovery-records" aria-label="Fichas guardadas">
        {[...records].sort((a,b)=>b.updatedAt-a.updatedAt).map(record=><li key={record.id}>
          <button type="button" disabled={locked} onClick={()=>open(edit(record))}>
            <ClipboardList size={17}/><span><strong>{record.title}</strong>
              {discoveryOutcome(record)&&<small>{discoveryOutcome(record)}</small>}</span><ArrowRight size={16}/>
          </button>
        </li>)}
      </ul>}
    </>:<>
      <div className="discovery-toolbar">
        <button type="button" disabled={locked} onClick={back}><ArrowLeft size={16}/>Volver a las fichas</button>
        <div className="hub-tools">
          {draft.id&&<button type="button" disabled={locked} onClick={()=>confirm({
            text:'¿Eliminar esta ficha de descubrimiento?',label:'Eliminar ficha',
            run:()=>{if(draft.id&&draft.expected!==undefined)void mutate({type:'removeDiscovery',id:draft.id,expected:draft.expected},()=>open());},
          })}><Trash2 size={15}/>Eliminar ficha</button>}
          <button type="button" className="hub-primary" disabled={locked||!valid.success||!dirty}
            onClick={()=>{if(valid.success)void persist(draft,valid.data);}}><Save size={15}/>Guardar ficha</button>
        </div>
      </div>
      <div className="hub-panel discovery-interview">
        <label className="discovery-project">Nombre del proyecto
          <input value={draft.fields.title} required maxLength={discoveryLimits.title} disabled={locked}
            onChange={event=>setDraft({...draft,fields:{...draft.fields,title:event.currentTarget.value}})}/>
        </label>
        <div className="discovery-heading">
          <span>{answered} de {essential.length} respuestas esenciales</span>
          <label className="discovery-check"><input type="checkbox" checked={showDetails} disabled={locked}
            onChange={event=>setShowDetails(event.currentTarget.checked)}/>Preguntas de detalle</label>
        </div>
        <nav className="discovery-steps" aria-label="Bloques de la entrevista">
          {discoveryGroups.map((item,index)=><button key={item.id} type="button" disabled={locked}
            aria-current={step===index?'step':undefined} onClick={()=>setStep(index)}>{item.label}</button>)}
        </nav>
        <fieldset className="discovery-questions" disabled={locked}>
          <legend className="discovery-legend">{group.label}</legend>
          {discoveryQuestions.filter(item=>item.group===group.id&&(showDetails||!item.detail)).map(item=>{
            const answer=draft.fields.answers[item.id];
            return <div className="discovery-question" key={item.id}>
              <label htmlFor={'discovery-'+item.id} lang="en">{item.en}</label>
              <p id={'discovery-es-'+item.id} className="hub-muted">{item.es}</p>
              <textarea id={'discovery-'+item.id} aria-describedby={'discovery-es-'+item.id} rows={2} maxLength={discoveryLimits.answer}
                placeholder="Anota la respuesta" value={answer?.text??''} onChange={event=>updateAnswer(item.id,{text:event.currentTarget.value})}/>
              <label className="discovery-check"><input type="checkbox" checked={answer?.pending??false}
                aria-label={'Por confirmar · '+item.topic} onChange={event=>updateAnswer(item.id,{pending:event.currentTarget.checked})}/>Por confirmar</label>
            </div>;
          })}
        </fieldset>
        <div className="discovery-step-controls">
          <button type="button" disabled={locked||step===0} onClick={()=>setStep(step-1)}><ArrowLeft size={15}/>Anterior</button>
          {step<discoveryGroups.length-1&&<button type="button" disabled={locked} onClick={()=>setStep(step+1)}>Siguiente<ArrowRight size={15}/></button>}
        </div>
      </div>
      <div className="hub-panel discovery-output">
        <div className="discovery-toolbar">
          <div><h2>Valoración</h2>{!ready&&<p className="hub-muted">Completa el nombre y confirma el objetivo para preparar la valoración.</p>}</div>
          <div className="hub-tools">
            <button type="button" disabled={locked||!ready} onClick={showProposal}><Sparkles size={16}/>Generar propuesta</button>
            <button type="button" className="hub-primary" disabled={locked||!ready} onClick={()=>void prepare()}><Send size={16}/>Valorar en Codex</button>
          </div>
        </div>
        {idea&&valid.success&&<div className="discovery-idea">
          <h3 tabIndex={-1} ref={ideaHeading}>Propuesta inicial de ZEN</h3>
          <div lang="en">
            <strong>{idea.name}</strong>
            <ol>{idea.screens.map(screen=><li key={screen}>{screen}</li>)}</ol>
            <dl>
              <dt>Business goal</dt><dd>{discoveryOutcome(valid.data)}</dd>
              {idea.scope&&<><dt>First-release scope</dt><dd>{idea.scope}</dd></>}
              {idea.roles&&<><dt>Roles to design for</dt><dd>{idea.roles}</dd></>}
              {idea.success&&<><dt>Success criteria</dt><dd>{idea.success}</dd></>}
              {idea.open.length>0&&<><dt>To confirm</dt><dd>{idea.open.map(item=>item.topic).join(' · ')}</dd></>}
            </dl>
          </div>
          <details><summary>Ver resumen en inglés</summary><pre lang="en">{discoveryBrief(valid.data)}</pre></details>
          <button type="button" disabled={locked} onClick={()=>void mutate({type:'copyDiscovery',fields:valid.data},()=>setFeedback({text:'Resumen copiado.'}))}><Copy size={15}/>Copiar resumen</button>
        </div>}
      </div>
      <div className="discovery-status" aria-live="polite">
        <span>{dirty?'Cambios sin guardar':draft.id?'Guardada':''}</span>
        {feedback&&<span role={feedback.error?'alert':'status'}>{feedback.text}</span>}
      </div>
    </>}
  </section>;
}
