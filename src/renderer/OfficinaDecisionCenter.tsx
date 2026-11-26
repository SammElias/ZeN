import React, {createContext, useEffect, useRef, useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {officinaActorName, type OfficinaDecision, type OfficinaProject} from '../shared/companion-officina';
import {officinaDecisionLabels} from '../shared/officina-decisions';

export const OfficinaDecisionContext = createContext({offline: false, drafts: new Map<string, string>()});
export const officinaDecisionPriority = {blocking: 'Bloqueante', high: 'Alta', normal: 'Normal'} as const;
export const officinaDecisionTime = new Intl.DateTimeFormat('es', {dateStyle: 'short', timeStyle: 'short'});

function age(at?: number) {
  if (at === undefined) return 'Fecha sin registrar';
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} d`;
}

export function OfficinaDecisionCenter({items, projects, onOpen, automatic}: {
  items: OfficinaDecision[]; projects: Pick<OfficinaProject, 'id' | 'name'>[];
  onOpen: (item: OfficinaDecision) => Promise<boolean>; automatic: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [project, setProject] = useState('');
  const [opening, setOpening] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const initialFocus = useRef(false);
  const visible = items.filter(item => (!project || project === item.project) &&
    (filter === 'all' || (filter === 'pending') === (item.status === 'pending')));
  const firstId = visible[0]?.id;
  useEffect(() => {
    if (!automatic || initialFocus.current || !first.current) return;
    first.current.focus();
    initialFocus.current = document.activeElement === first.current;
  }, [automatic, firstId]);
  return <div className="officina-decision-center">
    <div className="officina-decision-filters">
      <label>Estado <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
        <option value="pending">Pendientes</option><option value="resolved">Resueltas</option><option value="all">Todas</option>
      </select></label>
      <label>Proyecto <select value={project} onChange={event => setProject(event.target.value)}>
        <option value="">Todos los proyectos</option>
        {projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    {!visible.length && <p>{filter === 'pending' ? 'No hay decisiones pendientes.' : 'No hay decisiones para este filtro.'}</p>}
    <ol className="officina-decision-list">
      {visible.map((item, index) => <li key={`${item.project}:${item.kind}:${item.id}`}>
        <article>
          <header><strong>{item.roleName ?? officinaActorName(item.role)}</strong>
            <span data-priority={item.priority}>{item.status === 'pending' ? officinaDecisionPriority[item.priority] : officinaDecisionLabels[item.status]}</span></header>
          <small>{item.projectName} · {item.title ?? 'Chat del puesto'} · <span title={item.at === undefined ? undefined : officinaDecisionTime.format(item.at)}>{age(item.at)}</span></small>
          <p>{item.summary}</p>
          {item.feedback && <small>{item.feedback}</small>}
          {item.delivery && <small>{item.delivery === 'accepted' ? 'Continuación recibida por Codex' :
            item.delivery === 'uncertain' ? 'Revisar envío de la continuación en Codex' : 'Continuación en cola'}</small>}
        </article>
        <button ref={index === 0 ? first : undefined} type="button" disabled={opening} onClick={async () => {
          setOpening(true);
          try { await onOpen(item); } finally { setOpening(false); }
        }}>Abrir agente <ArrowRight aria-hidden="true"/></button>
      </li>)}
    </ol>
  </div>;
}
