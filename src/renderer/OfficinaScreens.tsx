import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {OfficinaRole} from '../shared/companion-officina';
import type {officinaRoleTracking} from '../shared/officina-tracking';
import './OfficinaScreens.css';

type ScreenState = ReturnType<typeof officinaRoleTracking>['state'];
type ScreenTeam = Record<OfficinaRole, {state: ScreenState}>;
type ScreenArrival = {id: string; role: OfficinaRole; delay: number};

const playbackRates: Partial<Record<ScreenState, number>> = {
  working: 1.32, checking: .66, done: 0, limited: 0, permission: 0, blocked: 0,
  information: 0, review: 0, interrupted: 0,
};

const codeLines = [
  ['import', " {board} from './office';"],
  ['', ''],
  ['export', ' function nextTask(items) {'],
  ['  const', ' pending = items.filter(item => {'],
  ['    return', " item.state === 'ready';"],
  ['', '  });'],
  ['', ''],
  ['  if', ' (!pending.length) {'],
  ['    return', ' null;'],
  ['', '  }'],
  ['  return', ' pending[0];'],
  ['', '}'],
  ['', ''],
  ['const', ' next = nextTask(board.items);'],
  ['if', ' (next) board.assign(next);'],
  ['', ''],
] as const;

function CodeScreen({variant, state, notification}: {variant: 'main' | 'side'; state: ScreenState; notification?: ReactNode}) {
  return <div className={`officina-screen officina-code officina-code--${variant}`} data-role="developer" data-state={state}>
    <div className="officina-code-viewport">
      <div className="officina-code-editor">
        <div className="officina-code-reel">
          {[0, 1].map(copy => <div className="officina-code-page" key={copy}>
            {codeLines.map(([keyword, line], index) => <code key={index}>
              <span className="officina-code-number">{index + 1}</span><b>{keyword}</b>{line}
            </code>)}
          </div>)}
        </div>
      </div>
      {notification}
    </div>
  </div>;
}

export function OfficinaScreens({team, animate, arrival}: {team: ScreenTeam; animate: boolean; arrival?: ScreenArrival}) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!animate || !layer.current) return;
    // Changing the rate keeps the current frame when a role starts or finishes a turn.
    for (const display of layer.current.querySelectorAll<HTMLElement>('[data-role]')) {
      const role = display.dataset.role as OfficinaRole;
      const rate = playbackRates[team[role].state] ?? .36;
      for (const animation of display.getAnimations({subtree: true})) {
        if (animation.effect?.getTiming().iterations === Infinity && animation.playbackRate !== rate) {
          animation.updatePlaybackRate(rate);
        }
      }
    }
  }, [team, animate]);
  const notification = (role: OfficinaRole) => arrival?.role === role &&
    <span className="officina-screen-arrival" key={arrival.id} style={{animationDelay: `${arrival.delay}ms`}}/>;

  return <div className="officina-screens" aria-hidden="true" ref={layer}>
    {OfficinaRole.options.map(role => <span key={role} className="officina-screen-reflection" data-role={role} data-state={team[role].state}>
      <span/>
    </span>)}
    <div className="officina-screen officina-analysis-screen" data-role="analyst" data-state={team.analyst.state}>
      <span className="officina-sticky-focus"/>
      <span className="officina-criteria-focus"/>
      <span className="officina-board-pointer"/>
      {notification('analyst')}
    </div>
    <div className="officina-screen officina-architecture-screen" data-role="architect" data-state={team.architect.state}>
      {Array.from({length: 6}, (_, index) => <span className="officina-diagram-node" key={index}/>)}
      {notification('architect')}
    </div>
    <CodeScreen variant="main" state={team.developer.state} notification={notification('developer')}/>
    <CodeScreen variant="side" state={team.developer.state}/>
    <div className="officina-screen officina-test-screen" data-role="tester" data-state={team.tester.state}>
      <span className="officina-test-focus"/>
      <span className="officina-test-progress"/>
      {notification('tester')}
    </div>
    <div className="officina-screen officina-release-screen" data-role="alm" data-state={team.alm.state}>
      <span className="officina-rocket-glow"/>
      <span className="officina-pipeline-pulse"/>
      {notification('alm')}
    </div>
  </div>;
}
