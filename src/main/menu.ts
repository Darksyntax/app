import { Menu, MenuItemConstructorOptions, BrowserWindow, app } from 'electron'

function send(channel: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel)
}

interface MenuHandlers {
  onNewPage: () => void
  onImport: () => void
}

export function buildMenu(handlers: MenuHandlers): Menu {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Page', accelerator: 'CmdOrCtrl+N', click: () => handlers.onNewPage() },
        { label: 'Delete Page', accelerator: 'CmdOrCtrl+Shift+Backspace', click: () => send('menu:delete-page') },
        { type: 'separator' },
        { label: 'Save Now', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { type: 'separator' },
        { label: 'Import as Page…', accelerator: 'CmdOrCtrl+O', click: () => handlers.onImport() },
        { label: 'Export…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('menu:export') },
        { type: 'separator' },
        { label: 'Reveal Pages Folder', click: () => send('menu:reveal-folder') },
        { label: 'Change Pages Location…', click: () => send('menu:change-location') },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('menu:find') },
        { label: 'Find in All Pages', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('menu:find-all') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => send('menu:toggle-sidebar') },
        { type: 'separator' },
        { label: 'Toggle Markdown Syntax', accelerator: 'CmdOrCtrl+/', click: () => send('menu:toggle-markup') },
        { label: 'Toggle Hyperfocus Mode', accelerator: 'CmdOrCtrl+.', click: () => send('menu:toggle-hyperfocus') },
        { label: 'Toggle Scratchpad', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('menu:toggle-scratchpad') },
        { label: 'Toggle Word Count', accelerator: 'CmdOrCtrl+Shift+W', click: () => send('menu:toggle-wordcount') },
        { type: 'separator' },
        { label: 'Toggle Dark Mode', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('menu:toggle-theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }])]
    }
  ]

  return Menu.buildFromTemplate(template)
}
