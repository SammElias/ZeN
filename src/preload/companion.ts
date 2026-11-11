import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron';
import type {CompanionBridge, CompanionStatus} from '../shared/codex-companion';
import {companionChannel, type CompanionCommand} from '../shared/companion-ipc';

function call<Command extends CompanionCommand>(name: Command, input?: unknown): ReturnType<CompanionBridge[Command]> {
  return ipcRenderer.invoke(companionChannel(name), input) as ReturnType<CompanionBridge[Command]>;
}

const bridge: CompanionBridge = {
  status: () => call('status'),
  onStatus: callback => {
    const channel = companionChannel('status');
    const listener = (_event: IpcRendererEvent, status: CompanionStatus) => callback(status);
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  },
  openRequest: text => call('openRequest', text),
  openSpotify: () => call('openSpotify'),
  appearanceSave: options => call('appearanceSave', options),
  appearanceChoose: () => call('appearanceChoose'),
  codexTab: tab => call('codexTab', tab),
  contextStatus: () => call('contextStatus'),
  contextChoose: () => call('contextChoose'),
  contextPrepare: input => call('contextPrepare', input),
  contextCancel: id => call('contextCancel', id),
  contextHandoff: id => call('contextHandoff', id),
  contextResult: () => call('contextResult'),
  contextSource: selection => call('contextSource', selection),
  navigate: page => call('navigate', page),
  notesRecent: () => call('notesRecent'),
  notesRead: () => call('notesRead'),
  notesChange: change => call('notesChange', change),
  notesDraft: draft => call('notesDraft', draft),
  notesFile: action => call('notesFile', action),
  togglePage: page => call('togglePage', page),
  launcher: open => call('launcher', open),
  launcherOrder: order => call('launcherOrder', order),
  launcherContext: page => call('launcherContext', page),
  options: () => call('options'),
  compact: view => call('compact', view),
  mediaNowPlaying: () => call('mediaNowPlaying'),
  mediaObservationClose: () => call('mediaObservationClose'),
  mediaCurrent: () => call('mediaCurrent'),
  mediaSnapshot: followSystem => call('mediaSnapshot', followSystem),
  mediaList: () => call('mediaList'),
  mediaSelect: id => call('mediaSelect', id),
  mediaRead: id => call('mediaRead', id),
  mediaCommand: input => call('mediaCommand', input),
  mediaClose: surface => call('mediaClose', surface),
  openCodex: id => call('openCodex', id),
  check: () => call('check'),
  install: () => call('install'),
  save: settings => call('save', settings),
  decide: (id, decision) => call('decide', {id, decision}),
  clearNotices: () => call('clearNotices'),
  copy: text => call('copy', text),
  sound: enabled => call('sound', enabled),
  silence: minutes => call('silence', minutes),
  testNotice: () => call('testNotice'),
  presentation: enabled => call('presentation', enabled),
  returnApp: () => call('returnApp'),
  locate: (session, path) => call('locate', {session, path}),
  hide: () => call('hide'),
  pinWindow: enabled => call('pinWindow', enabled),
  drag: action => call('drag', action),
  moveCapsule: alignment => call('moveCapsule', alignment),
};

contextBridge.exposeInMainWorld('companion', Object.freeze(bridge));
