import { contextBridge, ipcRenderer } from 'electron'

export interface PageMeta {
  id: string
  title: string
  preview: string
  createdAt: number
  updatedAt: number
}

const api = {
  listPages: (): Promise<PageMeta[]> => ipcRenderer.invoke('pages:list'),

  loadPage: (id: string): Promise<string> => ipcRenderer.invoke('pages:load', id),

  createPage: (): Promise<PageMeta> => ipcRenderer.invoke('pages:create'),

  savePage: (id: string, content: string): Promise<PageMeta | null> => ipcRenderer.invoke('pages:save', { id, content }),

  savePageSync: (id: string, content: string): PageMeta | null => ipcRenderer.sendSync('pages:save-sync', { id, content }),

  deletePage: (id: string): Promise<boolean> => ipcRenderer.invoke('pages:delete', id),

  importPage: (): Promise<{ meta: PageMeta; content: string } | null> => ipcRenderer.invoke('pages:import'),

  exportPage: (content: string, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('pages:export', { content, defaultName }),

  revealPagesFolder: (): void => {
    ipcRenderer.send('pages:reveal-folder')
  },

  setWindowTitle: (title: string): void => {
    ipcRenderer.send('window:set-title', title)
  },

  onPagesImported: (cb: (data: { meta: PageMeta; content: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { meta: PageMeta; content: string }): void => cb(data)
    ipcRenderer.on('pages:imported', listener)
    return () => ipcRenderer.removeListener('pages:imported', listener)
  },

  onMenu: (channel: string, cb: () => void): (() => void) => {
    ipcRenderer.on(channel, cb)
    return () => ipcRenderer.removeListener(channel, cb)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

declare global {
  interface Window {
    api: Api
  }
}
