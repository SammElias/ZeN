import {useLayoutEffect, useRef, type ReactNode} from 'react';
import {OfficinaRole} from '../shared/companion-officina';
import type {officinaRoleTracking} from '../shared/officina-tracking';
import {officinaCanRest} from './OfficinaIdleScene';
import zenDesk from './assets/officina-zen-desk.png';
import zenCoffee from './assets/officina-zen-seated-coffee.png';
import './OfficinaScreens.css';

type ScreenState = ReturnType<typeof officinaRoleTracking>['state'];
type ScreenRole = OfficinaRole | 'coordinator' | 'observer';
type ScreenTeam = Record<ScreenRole, {state: ScreenState}>;
type ScreenArrival = {id: string; role: OfficinaRole; delay: number};

const playbackRates: Partial<Record<ScreenState, number>> = {working: 1.24, checking: 1.04};
const testRows = ['pass', 'run', 'pass', 'queued', 'pass', 'queued'] as const;
const telemetry = [34, 62, 43, 86, 57, 93, 70, 46] as const;

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

function ObserverStation({state, animate}: {state: ScreenState; animate: boolean}) {
  return <div className="officina-observer-station">
    <img className="officina-observer-furniture" src={zenDesk} alt="" draggable={false}/>
    {animate && <img className="officina-observer-look" data-seated-gesture="observer" src={zenDesk} alt="" draggable={false}/>}
    {animate && officinaCanRest(state) &&
      <img className="officina-observer-coffee" data-coffee="observer" src={zenCoffee} alt="" draggable={false}/>}
    <span className="officina-screen-reflection officina-observer-reflection" data-role="observer" data-state={state}><span/></span>
    <div className="officina-screen officina-observer-monitor" data-role="observer" data-state={state}>
      <span className="officina-observer-status"/>
      <div className="officina-observer-checks"><span/><span/><span/><i/></div>
      <div className="officina-observer-telemetry">
        <div className="officina-observer-reel">
          {[0, 1].map(copy => <div className="officina-observer-bars" key={copy}>
            {telemetry.map((height, index) => <span key={index} style={{height: `${height}%`}}/>)}
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}

export function OfficinaScreens({team, animate, arrival}: {team: ScreenTeam; animate: boolean; arrival?: ScreenArrival}) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!animate || !layer.current) return;
    // Every screen keeps its phase when it switches between ambient and task activity.
    for (const display of layer.current.querySelectorAll<HTMLElement>('[data-role]')) {
      const role = display.dataset.role as ScreenRole;
      const rate = playbackRates[team[role].state] ?? .86;
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
      <span className="officina-diagram-packet"/><span className="officina-diagram-packet"/>
      {notification('architect')}
    </div>
    <CodeScreen variant="main" state={team.developer.state} notification={notification('developer')}/>
    <CodeScreen variant="side" state={team.developer.state}/>
    <div className="officina-screen officina-test-screen" data-role="tester" data-state={team.tester.state}>
      <div className="officina-test-display">
        <div className="officina-test-runner">
          <div className="officina-test-header"><i/><b/></div>
          <div className="officina-test-viewport">
            <div className="officina-test-reel">
              {[0, 1].map(copy => <div className="officina-test-page" key={copy}>
                {testRows.map((state, index) => <div className="officina-test-row" data-sample={state} key={index}>
                  <i/><span/><b/>
                </div>)}
              </div>)}
            </div>
          </div>
          <div className="officina-test-track"><span className="officina-test-progress"/></div>
        </div>
      </div>
      {notification('tester')}
    </div>
    <div className="officina-screen officina-release-screen" data-role="alm" data-state={team.alm.state}>
      <span className="officina-rocket-glow"/>
      <span className="officina-pipeline-pulse"/>
      {notification('alm')}
    </div>
    <div className="officina-screen officina-coordinator-screen" data-role="coordinator" data-state={team.coordinator.state}>
      <span/>
    </div>
    <ObserverStation state={team.observer.state} animate={animate}/>
  </div>;
}
