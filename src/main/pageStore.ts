import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, cpSync } from 'fs'

export interface PageMeta {
  id: string
  title: string
  preview: string
  order: number
  createdAt: number
  updatedAt: number
}

const pagesDir = join(app.getPath('userData'), 'pages')
const manifestPath = join(app.getPath('userData'), 'pages.json')

function ensureDirs(): void {
  if (!existsSync(pagesDir)) mkdirSync(pagesDir, { recursive: true })
}

function pagePath(id: string): string {
  return join(pagesDir, `${id}.md`)
}

// Electron's userData directory is keyed off the app's product name, so
// renaming the app points it at a brand new, empty folder. Bring existing
// pages over from the old name's folder the first time this runs after a rename.
export function migrateFromOldAppName(oldProductName: string): void {
  const oldRoot = join(app.getPath('appData'), oldProductName)
  if (oldRoot === app.getPath('userData')) return
  if (existsSync(manifestPath)) return // this app name already has data; don't clobber it
  ensureDirs()
  const oldManifest = join(oldRoot, 'pages.json')
  const oldPagesDir = join(oldRoot, 'pages')
  if (existsSync(oldManifest)) writeFileSync(manifestPath, readFileSync(oldManifest))
  if (existsSync(oldPagesDir)) cpSync(oldPagesDir, pagesDir, { recursive: true })
}

// One-time upgrade for pages saved under the app's old .txt convention.
let migratedLegacyFiles = false
function migrateLegacyTxtFiles(): void {
  if (migratedLegacyFiles) return
  migratedLegacyFiles = true
  ensureDirs()
  for (const page of readManifest()) {
    const newPath = pagePath(page.id)
    const oldPath = join(pagesDir, `${page.id}.txt`)
    if (!existsSync(newPath) && existsSync(oldPath)) renameSync(oldPath, newPath)
  }
}

// One-time upgrade for pages saved before drag-reordering existed: give them
// an explicit `order` matching their old implicit updatedAt-descending sort,
// so nothing visually jumps around the first time this runs.
let migratedOrderField = false
function migrateMissingOrder(): void {
  if (migratedOrderField) return
  migratedOrderField = true
  const pages = readManifest()
  if (pages.every((p) => typeof p.order === 'number')) return
  const sorted = [...pages].sort((a, b) => b.updatedAt - a.updatedAt)
  sorted.forEach((p, i) => {
    p.order = i
  })
  writeManifest(sorted)
}

function readManifest(): PageMeta[] {
  ensureDirs()
  if (!existsSync(manifestPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeManifest(pages: PageMeta[]): void {
  ensureDirs()
  writeFileSync(manifestPath, JSON.stringify(pages, null, 2), 'utf-8')
}

function deriveTitle(content: string): string {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0)
  if (!firstLine) return 'Untitled'
  const cleaned = firstLine.trim().replace(/^#{1,6}\s+/, '')
  return cleaned.slice(0, 80) || 'Untitled'
}

function derivePreview(content: string): string {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return (lines[1] ?? '').slice(0, 140)
}

export function listPages(): PageMeta[] {
  migrateLegacyTxtFiles()
  migrateMissingOrder()
  return readManifest().sort((a, b) => a.order - b.order)
}

export function loadPageContent(id: string): string {
  const target = pagePath(id)
  if (!existsSync(target)) return ''
  return readFileSync(target, 'utf-8')
}

export function createPage(initialContent = ''): PageMeta {
  ensureDirs()
  const now = Date.now()
  const pages = readManifest()
  const minOrder = pages.length ? Math.min(...pages.map((p) => p.order ?? 0)) : 0
  const meta: PageMeta = {
    id: randomUUID(),
    title: deriveTitle(initialContent),
    preview: derivePreview(initialContent),
    order: minOrder - 1,
    createdAt: now,
    updatedAt: now
  }
  writeFileSync(pagePath(meta.id), initialContent, 'utf-8')
  pages.push(meta)
  writeManifest(pages)
  return meta
}

export function savePage(id: string, content: string): PageMeta | null {
  ensureDirs()
  const pages = readManifest()
  const index = pages.findIndex((p) => p.id === id)
  if (index === -1) return null
  writeFileSync(pagePath(id), content, 'utf-8')
  pages[index] = {
    ...pages[index],
    title: deriveTitle(content),
    preview: derivePreview(content),
    updatedAt: Date.now()
  }
  writeManifest(pages)
  return pages[index]
}

export function deletePage(id: string): void {
  const pages = readManifest().filter((p) => p.id !== id)
  writeManifest(pages)
  const target = pagePath(id)
  if (existsSync(target)) unlinkSync(target)
}

// orderedIds is the full list of page ids in their new desired top-to-bottom order.
export function reorderPages(orderedIds: string[]): void {
  const pages = readManifest()
  const byId = new Map(pages.map((p) => [p.id, p]))
  orderedIds.forEach((id, i) => {
    const page = byId.get(id)
    if (page) page.order = i
  })
  writeManifest(pages)
}

export function pageFilePath(id: string): string {
  return pagePath(id)
}

export function pagesDirectory(): string {
  ensureDirs()
  return pagesDir
}
