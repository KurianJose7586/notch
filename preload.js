const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notch', {
  onSessions: fn => ipcRenderer.on('sessions', (_, s, limits) => fn(s, limits || {})),
  onKeyboard: fn => ipcRenderer.on('keyboard', (_, on) => fn(on)),
  onGoodbye: fn => ipcRenderer.on('goodbye', (_, kind) => fn(kind)),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
})
