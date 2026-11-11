import type {CompanionBridge} from './codex-companion';

export type CompanionCommand = Exclude<keyof CompanionBridge, 'onStatus'>;

export const companionChannel = (command: CompanionCommand) => `companion:${command}` as const;
