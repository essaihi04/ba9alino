const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ba9alino', {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getTargetUrl: () => ipcRenderer.invoke('app:getTargetUrl')
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onStatus: (cb) => {
      const handler = (_e, payload) => cb(payload)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    },
    onProgress: (cb) => {
      const handler = (_e, payload) => cb(payload)
      ipcRenderer.on('updater:download-progress', handler)
      return () => ipcRenderer.removeListener('updater:download-progress', handler)
    }
  },
  supabase: {
    signInWithPassword: (email, password) => ipcRenderer.invoke('supabase:signInWithPassword', { email, password }),
    signOut: () => ipcRenderer.invoke('supabase:signOut'),
    getSession: () => ipcRenderer.invoke('supabase:getSession'),
    products: {
      list: () => ipcRenderer.invoke('supabase:products:list'),
      cache: () => ipcRenderer.invoke('supabase:products:cache')
    },
    sales: {
      sync: (payload) => ipcRenderer.invoke('supabase:sales:sync', payload),
      queue: () => ipcRenderer.invoke('supabase:sales:queue')
    }
  },
  dialog: {
    showError: (title, message) => ipcRenderer.invoke('dialog:showError', { title, message })
  }
})
