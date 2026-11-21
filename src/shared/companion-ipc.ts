import type {CompanionBridge} from './codex-companion';

export type CompanionCommand = Exclude<keyof CompanionBridge, 'onStatus'|'onInterfaceEffect'|'onVaultSignal'>;
export const companionInterfaceEffectChannel = 'companion:interface-effect';

export const companionChannel = (command: CompanionCommand) => `companion:${command}` as const;
