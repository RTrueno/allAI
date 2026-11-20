'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['retry', 'home', 'reload', 'back', 'forward', 'browser']);
contextBridge.exposeInMainWorld('allAI', {
  getState: () => ipcRenderer.invoke('allai:state'),
  action: action => { if (actions.has(action)) ipcRenderer.send('allai:action', action); },
  onState: callback => { ipcRenderer.on('allai:state', (_event, state) => callback(state)); },
});
