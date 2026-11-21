import type {CompanionSettings} from './codex-companion';

export const interfaceTones = {
  press:     {ms:38, from:680, to:495, decay:3.0, level:.90},
  navigate:  {ms:64, from:505, to:610, decay:2.6, level:.77},
  expand:    {ms:126, from:370, to:650, decay:1.9, level:.78},
  collapse:  {ms:112, from:615, to:358, decay:2.4, level:.76},
  open:      {ms:96, from:460, to:575, decay:2.1, level:.76},
  close:     {ms:88, from:550, to:413, decay:2.3, level:.75},
  success:   {ms:154, from:555, to:730, decay:2.3, level:.80},
  attention: {ms:139, from:650, to:600, decay:2.0, level:.82},
  error:     {ms:165, from:500, to:375, decay:2.2, level:.88},
} as const;

export type InterfaceEffect = keyof typeof interfaceTones;

export function interfaceSoundEnabled(settings: Pick<CompanionSettings, 'interfaceSounds'|'sounds'>) {
  return settings.interfaceSounds ?? settings.sounds;
}

type Surface = {island:boolean; expanded:boolean; page:string; tab?:string; disclosure?:string};

export function surfaceSound(before: Surface, after: Surface): InterfaceEffect | undefined {
  if (before.island !== after.island) return after.island ? 'collapse' : 'expand';
  if (before.expanded !== after.expanded) return after.expanded ? 'open' : 'close';
  if (!after.expanded) return;
  if (after.disclosure && before.disclosure !== after.disclosure) return 'open';
  if (before.page !== after.page || before.tab !== after.tab) return 'navigate';
}
