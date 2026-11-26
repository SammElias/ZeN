import {
  officinaActorName, officinaDeliveryQa, officinaEventLabels, officinaOpenItems,
  type OfficinaActor, type OfficinaEvent, type OfficinaProject, type OfficinaTask,
} from '../../shared/companion-officina';
import {officinaResults} from '../../shared/officina-results';
import {officinaTrackingLabels, type officinaRoleTracking} from '../../shared/officina-tracking';

type Tracking = ReturnType<typeof officinaRoleTracking>;
export type RoomLine = {label: string; text: string};
export type RoomDisplay = {
  name: string; state: Tracking['state']; status: string; task?: string;
  decision?: {action: string; question: string};
  lines: RoomLine[]; proposal?: string; diagram?: {nodes: string[]; edges: [string, string][]};
  last?: OfficinaEvent;
  release?: {version?: string; stages: RoomLine[]};
};

const titles: Record<OfficinaActor, string> = {
  coordinator: 'Plan del encargo', analyst: 'Requisitos', architect: 'Propuesta técnica',
  developer: 'Desarrollo', tester: 'Validación', alm: 'Versiones y entregas', observer: 'Seguimiento',
};

export function architectureDiagram(markdown?: string) {
  const block = markdown?.match(/```mermaid\s*\r?\n\s*erDiagram\s*\r?\n([\s\S]*?)```/i)?.[1];
  if (!block) return undefined;
  const edges: [string, string][] = [];
  const nodes = new Set<string>();
  for (const line of block.split(/\r?\n/)) {
    const relation = line.match(/^\s*([\w-]+)\s+[|o{}.-]+\s+([\w-]+)\s*:/);
    if (relation) {
      edges.push([relation[1], relation[2]]);
      nodes.add(relation[1]);
      nodes.add(relation[2]);
    }
    const entity = line.match(/^\s*([\w-]+)\s*\{/);
    if (entity) nodes.add(entity[1]);
  }
  return nodes.size ? {nodes: [...nodes], edges} : undefined;
}

export function roomDisplay(role: OfficinaActor, tracking: Tracking, project: OfficinaProject | undefined, task: OfficinaTask | undefined,
  decision?: RoomDisplay['decision']): RoomDisplay {
  const name = officinaActorName(role, project);
  const status = tracking.label ?? officinaTrackingLabels[tracking.state];
  const display: RoomDisplay = {name, state: tracking.state, status, decision, lines: []};
  if (!project) return display;
  if (role==='observer') {
    const review=project.reviews?.filter(item=>item.report && (item.scope===task?.id || !item.scope)).at(-1);
    if(review?.scope || tracking.state!=='idle' || decision) display.task=task?.title;
    if(review?.report) {
      display.lines.push({label:review.scope?'Revisión del encargo':'Revisión del proyecto',text:review.report.text},
        ...review.report.proposals.map(p=>({label:p.title,text:p.evidence})));
    }
    return display;
  }
  if (!task) return display;
  const goal = project.goals?.find(item => item.task === task.id);
  const events = project.events.filter(event => event.task === task.id);
  const sharedPlan=role==='coordinator' && (goal?.steps.length || events.some(e=>e.data.kind==='handoff'));
  const sharedDelivery=role==='alm' && events.some(e=>e.data.kind==='handoff' &&
    (e.from==='alm' || e.data.to==='alm' || e.from==='developer' && e.data.to==='tester'));
  if (tracking.state==='idle' && !decision && !sharedPlan && !sharedDelivery) return display;
  display.task = task.title;
  const last = role !== 'coordinator' ? events.filter(event => event.from === role).at(-1) : undefined;
  display.last = last;
  const result = officinaResults(project, task.id, role).at(-1);
  const lines: RoomLine[] = [];
  const add = (label: string, text?: string) => {if (text) lines.push({label, text});};
  switch (role) {
    case 'coordinator': {
      goal?.steps.forEach((step, index) => {
        const previous = goal.steps[index - 1];
        const stage = index < goal.cursor ? 'Completado' : index === goal.cursor ? goal.humanRequest || goal.question ? 'Espera decisión' : 'Paso actual' : 'En espera';
        add(`${index + 1}. ${officinaActorName(step.role, project)} · ${stage}`,
          step.instruction + (index > goal.cursor && previous ? ` Depende de ${officinaActorName(previous.role, project)}.` : ''));
      });
      const handoff = events.filter(event => event.data.kind === 'handoff').at(-1);
      if (handoff?.data.kind === 'handoff') add('Último traspaso',
        `${officinaActorName(handoff.from, project)} → ${officinaActorName(handoff.data.to, project)} · ${handoff.data.text}`);
      break;
    }
    case 'analyst':
      add('Objetivo', task.objective);
      add('Criterios de aceptación', task.criteria);
      for (const event of officinaOpenItems(events)) if (event.from === role && event.data.kind === 'question') {
        add('Pregunta pendiente', event.data.text);
      }
      break;
    case 'architect': {
      const request = decision ? goal?.humanRequest : undefined;
      add('Propuesta', request?.text ?? last?.data.text ?? result?.message?.text);
      const proposal = request?.markdown ?? last?.data.markdown ?? result?.message?.markdown;
      display.proposal = proposal;
      display.diagram = architectureDiagram(proposal);
      break;
    }
    case 'developer': {
      const delivery = events.filter(event => event.from === role && event.data.kind === 'handoff').at(-1);
      if (delivery?.data.kind === 'handoff') {
        add('Versión entregada', delivery.data.artifact.version);
        add('Entregable', delivery.data.artifact.link);
      }
      add('Cambios registrados', last?.data.text);
      break;
    }
    case 'tester': {
      const qa = officinaDeliveryQa(events, task.id);
      const delivery = events.filter(event => event.from === 'developer' && event.data.kind === 'handoff' && event.data.to === 'tester').at(-1);
      const check = delivery ? events.filter(event => event.from === role && event.data.kind === 'qa' && event.data.replyTo === delivery.id).at(-1) : undefined;
      add('Versión en validación', qa?.version);
      if (check?.data.kind === 'qa') {
        add(check.data.passed ? 'QA aprobado' : 'QA bloqueado', check.data.text);
        add('Pruebas y evidencia', check.data.evidence);
      } else if (qa) add('Resultado de QA', 'Pendiente de confirmación');
      break;
    }
    case 'alm': {
      const delivery = events.filter(e => e.data.kind === 'handoff' &&
        (e.from === 'alm' || e.data.to === 'alm' || e.from === 'developer' && e.data.to === 'tester')).at(-1);
      const version = delivery?.data.kind === 'handoff' ? delivery.data.artifact.version : undefined;
      const qa = officinaDeliveryQa(events,task.id);
      const stages:RoomLine[]=[];
      if (delivery?.data.kind === 'handoff') stages.push({label:'Traspaso',text:officinaActorName(delivery.from,project)+' → '+officinaActorName(delivery.data.to,project)});
      if (qa && qa.version === version && qa.passed !== undefined) stages.push({label:'Validación',text:qa.passed ? 'QA aprobado' : 'QA bloqueado'});
      if (last && last.id !== delivery?.id && (!delivery || last.at >= delivery.at))
        stages.push({label:officinaEventLabels[last.data.kind],text:last.data.text});
      display.release={version,stages};
      add('Versión registrada',version);
      lines.push(...stages);
      if (delivery?.data.kind === 'handoff') add('Entrega',delivery.data.text);
      break;
    }
  }
  display.lines = lines;
  return display;
}

export {titles as roomScreenTitles};
