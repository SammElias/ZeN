export const navigationHoverDelay = 150;

export const motion = {
  press: 90,
  hover: 120,
  navigation: 160,
  appCube: 480,
  panel: 200,
  panelTransition: 600,
  island: 250,
  note: 250,
  exit: 100,
  shift: 10,
  enterEase: 'cubic-bezier(.2,.75,.25,1)',
  exitEase: 'cubic-bezier(.4,0,.8,.5)',
} as const;

export function surfaceProgress(progress: number, closing: boolean) {
  // Closing clears the controls for one paint before the native region shrinks.
  const position = closing ? Math.max(0, (progress-.08)/.92) : progress;
  return 1-(1-position)**3;
}
