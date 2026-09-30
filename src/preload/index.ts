import { contextBridge, ipcRenderer } from 'electron';
import type { ZenBridge, TaskEvent } from '../shared/contracts';
const bridge: ZenBridge = {
  settings: () => ipcRenderer.invoke('zen:settings'),
  saveSettings: value => ipcRenderer.invoke('zen:save-settings', value),
  saveKey: value => ipcRenderer.invoke('zen:save-key', value),
  deleteKey: () => ipcRenderer.invoke('zen:delete-key'),
  run: value => ipcRenderer.invoke('zen:run', value),
  stop: () => ipcRenderer.invoke('zen:stop'),
  voiceStart: sdp => ipcRenderer.invoke('zen:voice-start', sdp),
  voiceEnd: value => ipcRenderer.invoke('zen:voice-end', value),
  clearLogs: () => ipcRenderer.invoke('zen:clear-logs'),
  onTask: callback => { const handler = (_event: unknown, data: TaskEvent) => callback(data); ipcRenderer.on('zen:task', handler); return () => ipcRenderer.removeListener('zen:task', handler); },
  onInvoke: callback => { const handler = () => callback(); ipcRenderer.on('zen:invoke', handler); return () => ipcRenderer.removeListener('zen:invoke', handler); }
};
contextBridge.exposeInMainWorld('zen', bridge);
