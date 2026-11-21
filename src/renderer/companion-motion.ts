import {motion} from '../shared/companion-motion';

export const motionStyle = Object.fromEntries(Object.entries(motion).map(([name,value])=>[
  '--motion-'+name,typeof value==='number'?value+(name==='shift'?'px':'ms'):value,
]));

export function canAnimate(element: Element) {
  return !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    element.closest('[data-motion]')?.getAttribute('data-motion')==='true';
}

type CubePanel = HTMLElement & {startViewTransition?(update:()=>void):ViewTransition};

export function startCubeTurn(element: HTMLElement, direction: 'top' | 'bottom', update: () => void) {
  const panel = element as CubePanel;
  if (!panel.startViewTransition || !panel.clientHeight) return;
  let cleared = false;
  function clear() {
    if (cleared) return;
    cleared = true;
    delete panel.dataset.cubeDirection;
    panel.style.removeProperty('--cube-depth');
  }
  panel.style.setProperty('--cube-depth', `${panel.clientHeight/2}px`);
  panel.dataset.cubeDirection = direction;
  try {
    const view = panel.startViewTransition(update);
    void view.ready.catch(()=>{});
    void view.finished.then(clear,clear);
    return {view, cancel:()=>{view.skipTransition();clear();}};
  } catch {
    clear();
  }
}

export function visibleRect(element: Element | null) {
  const rect=element?.getBoundingClientRect();
  if(!rect?.width||!rect.height||rect.bottom<=0||rect.right<=0||rect.top>=innerHeight||rect.left>=innerWidth)return;
  const scroll=element?.closest('.notes-list');
  if(scroll){
    const viewport=scroll.getBoundingClientRect();
    if(rect.bottom<=viewport.top||rect.top>=viewport.bottom)return;
  }
  return rect;
}

export function positionNoteMenu(menu:HTMLDetailsElement) {
  if(!menu.open)return;
  const options=menu.querySelector('div'),rect=menu.getBoundingClientRect();
  const height=options?.scrollHeight??0;
  menu.dataset.origin=innerHeight-rect.bottom<height+8&&rect.top>height+8?'above':'below';
}
