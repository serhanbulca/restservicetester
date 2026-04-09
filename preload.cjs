const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  makeRequest: (req) => ipcRenderer.invoke('make-request', req),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (name) => ipcRenderer.invoke('create-project', name), // <-- BU SATIR ÇOK ÖNEMLİ
  loadProject: (name) => ipcRenderer.invoke('load-project', name),
  saveProject: (name, data) => ipcRenderer.invoke('save-project', name, data)
});