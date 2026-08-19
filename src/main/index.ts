import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { buildMenu } from './menu'
import * as pageStore from './pageStore'
import type { PageMeta } from './pageStore'

const FILE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
  { name: 'All Files', extensions: ['*'] }
]

// Packaged builds get their icon baked in via electron-builder (build/icon.icns
// etc., configured in package.json); this path only matters for `npm run dev`,
// where Electron otherwise shows its own default icon.
const iconPath = join(__dirname, '../../build/icon.png')

// package.json's "name" is lowercase ("calliope", npm convention); this is what
// shows up in the About panel and the app menu label, so set the properly-cased
// display name explicitly rather than relying on that fallback. Note this can't
// touch the Dock tooltip or Cmd-Tab switcher name in dev mode -- those come from
// the actual Electron.app bundle we're running from unpackaged, and only take
// on the real name once the app is packaged (npm run dist:mac).
app.setName('Calliope')

let mainWindow: BrowserWindow | null = null
let pendingImportPath: string | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#f1f0eb',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('ready-to-show', () => {
    win.show()
    if (pendingImportPath) {
      const path = pendingImportPath
      pendingImportPath = null
      void importFileIntoWindow(win, path)
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

async function importFileIntoWindow(win: BrowserWindow, filePath: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const meta = pageStore.createPage(content)
    win.webContents.send('pages:imported', { meta, content })
  } catch (err) {
    dialog.showErrorBox('Could not import file', String(err))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.calliope.app')
  pageStore.migrateFromOldAppName('Quire')

  app.setAboutPanelOptions({
    applicationName: 'Calliope',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    iconPath,
    copyright: 'A lightweight, distraction-free writing app.'
  })

  if (is.dev) app.dock?.setIcon(iconPath)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  Menu.setApplicationMenu(
    buildMenu({
      onNewPage: () => mainWindow?.webContents.send('menu:new-page'),
      onImport: () => void handleImportDialog(mainWindow)
    })
  )

  ipcMain.handle('pages:list', (): PageMeta[] => pageStore.listPages())

  ipcMain.handle('pages:load', (_event, id: string): string => pageStore.loadPageContent(id))

  ipcMain.handle('pages:create', (): PageMeta => pageStore.createPage())

  ipcMain.handle('pages:save', (_event, { id, content }: { id: string; content: string }): PageMeta | null =>
    pageStore.savePage(id, content)
  )

  ipcMain.on('pages:save-sync', (event, { id, content }: { id: string; content: string }) => {
    event.returnValue = pageStore.savePage(id, content)
  })

  ipcMain.handle('pages:reorder', (_event, orderedIds: string[]): void => pageStore.reorderPages(orderedIds))

  // Confirmation happens in the renderer's own themed modal now (native
  // dialog.showMessageBox has no styling hooks); this just performs the delete.
  ipcMain.handle('pages:delete', (_event, id: string): void => pageStore.deletePage(id))

  ipcMain.handle('pages:import', async (event): Promise<{ meta: PageMeta; content: string } | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILE_FILTERS })
    if (result.canceled || result.filePaths.length === 0) return null
    const content = await readFile(result.filePaths[0], 'utf-8')
    const meta = pageStore.createPage(content)
    return { meta, content }
  })

  ipcMain.handle('pages:export', async (event, { content, defaultName }: { content: string; defaultName: string }): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showSaveDialog(win, { filters: FILE_FILTERS, defaultPath: `${defaultName}.md` })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  })

  ipcMain.on('window:set-title', (event, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setTitle(title)
  })

  ipcMain.on('pages:reveal-folder', () => {
    shell.openPath(pageStore.pagesDirectory())
  })

  ipcMain.handle('pages:change-location', async (event): Promise<boolean> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: pageStore.currentPagesRoot(),
      buttonLabel: 'Use This Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return false
    const outcome = pageStore.relocatePagesRoot(result.filePaths[0])
    if (!outcome.ok) {
      dialog.showErrorBox('Could Not Change Location', outcome.reason)
      return false
    }
    await dialog.showMessageBox(win, {
      type: 'info',
      message: 'Pages location updated',
      detail: `Your pages now live in:\n${result.filePaths[0]}`
    })
    return true
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (mainWindow) {
    void importFileIntoWindow(mainWindow, path)
  } else if (app.isReady()) {
    pendingImportPath = path
    createWindow()
  } else {
    pendingImportPath = path
  }
})

async function handleImportDialog(win: BrowserWindow | null): Promise<void> {
  if (!win) return
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: FILE_FILTERS })
  if (result.canceled || result.filePaths.length === 0) return
  await importFileIntoWindow(win, result.filePaths[0])
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
