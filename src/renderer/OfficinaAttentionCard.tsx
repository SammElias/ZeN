import React from 'react';
import {AlertCircle, ArrowRight, RotateCw, ShieldCheck} from 'lucide-react';
import type {CompanionApproval} from '../shared/codex-companion';
import type {OfficinaAttention} from '../shared/officina-attention';
import {officinaActorName, officinaDeliveryQa, type OfficinaAction, type OfficinaProject} from '../shared/companion-officina';

export function OfficinaAttentionCard({item, project, act, approvals, openTask}: {
  item: OfficinaAttention; project: OfficinaProject; act: (action: OfficinaAction) => Promise<boolean>;
  approvals: CompanionApproval[]; openTask?: (id: string) => void;
}) {
  const {task} = item;
  const qa = item.kind === 'closure' ? officinaDeliveryQa(project.events, task.id) : undefined;
  const approval = item.kind === 'permission' && item.turn ? approvals.find(entry =>
    entry.session === item.run.destination?.thread && entry.turn === item.turn && entry.expiresAt > Date.now()) : undefined;
  const completedReply = item.kind === 'dispatch' && item.run.state === 'review' && item.run.turn && item.run.destination;
  const title = item.kind === 'permission' ? 'Tu autorización es necesaria' :
    item.kind === 'closure' ? 'Cierre de Coordinación pendiente' :
      item.kind === 'question' ? 'Coordinación necesita una respuesta' : completedReply ? 'Revisar respuesta' : 'Revisar envío';
  const Icon = item.kind === 'permission' ? ShieldCheck : item.kind === 'closure' ? RotateCw : AlertCircle;
  return <section className="officina-next" data-kind={item.kind} aria-label={title} role="status">
    <strong><Icon aria-hidden="true"/>{title}</strong>
    {openTask && <small title={task.title}>{task.title}</small>}
    {item.kind === 'permission' && <>
      <p>{officinaActorName(item.run.role, project)} espera tu permiso{approval ? ` para usar ${approval.tool}` : ' en Codex'}.</p>
      {approval?.preview && <p className="officina-permission-preview">{approval.preview}</p>}
      {approval ? <button className="officina-next-action" onClick={() => void window.companion.navigate('permissions')}>
        Revisar permiso <ArrowRight aria-hidden="true"/>
      </button> : <button className="officina-next-action" onClick={() =>
        void act({type: 'open-run-chat', project: project.id, task: task.id, run: item.run.id})}>
        Revisar en Codex <ArrowRight aria-hidden="true"/>
      </button>}
    </>}
    {item.kind === 'closure' && <>
      {qa?.passed === true && <p className="officina-qa-passed">QA aprobó la versión <code>{qa.version}</code>.</p>}
      <p>Coordinación puede retomar la conclusión con los informes guardados.</p>
      <div className="officina-next-actions">
        <button className="officina-next-action" onClick={() =>
          void act({type: 'retry-closure', project: project.id, task: task.id, run: item.run.id})}>Reintentar cierre</button>
        {openTask && <button onClick={() => openTask(task.id)}>Ver informes</button>}
      </div>
    </>}
    {item.kind === 'question' && <>
      {openTask && <p className="officina-question-preview">{item.question}</p>}
      {openTask && <button className="officina-next-action" onClick={() => openTask(task.id)}>Responder <ArrowRight aria-hidden="true"/></button>}
    </>}
    {item.kind === 'dispatch' && <>
      <p>{item.run.issue}</p>
      {completedReply ? <button className="officina-next-action" onClick={() =>
        void act({type: 'open-run-chat', project: project.id, task: task.id, run: item.run.id})}>
        Abrir respuesta en Codex <ArrowRight aria-hidden="true"/>
      </button> : openTask && <button className="officina-next-action" onClick={() => openTask(task.id)}>Ver turno <ArrowRight aria-hidden="true"/></button>}
    </>}
  </section>;
}
