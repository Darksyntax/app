import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, cpSync, rmSync } from 'fs'

export interface PageMeta {
  id: string
  title: string
  preview: string
  order: number
  createdAt: number
  updatedAt: number
}

// This fixed location never moves, unlike pagesRoot below -- it's where we
// remember WHERE the user's chosen pages location actually is, so relocating
// doesn't create a bootstrapping problem (we can't look inside a folder we
// don't yet know the path to).
const defaultRoot = app.getPath('userData')
const locationConfigPath = join(defaultRoot, 'location.json')

function readLocationConfig(): string {
  try {
    if (existsSync(locationConfigPath)) {
      const parsed = JSON.parse(readFileSync(locationConfigPath, 'utf-8'))
      if (typeof parsed.pagesRoot === 'string' && existsSync(parsed.pagesRoot)) return parsed.pagesRoot
    }
  } catch {
    // fall through to default
  }
  return defaultRoot
}

let pagesRoot = readLocationConfig()

function pagesDir(): string {
  return join(pagesRoot, 'pages')
}

function manifestPath(): string {
  return join(pagesRoot, 'pages.json')
}

function ensureDirs(): void {
  if (!existsSync(pagesDir())) mkdirSync(pagesDir(), { recursive: true })
}

function pagePath(id: string): string {
  return join(pagesDir(), `${id}.md`)
}

// Electron's userData directory is keyed off the app's product name, so
// renaming the app points it at a brand new, empty folder. Bring existing
// pages over from the old name's folder the first time this runs after a rename.
export function migrateFromOldAppName(oldProductName: string): void {
  const oldRoot = join(app.getPath('appData'), oldProductName)
  if (oldRoot === app.getPath('userData')) return
  if (existsSync(manifestPath())) return // this app name already has data; don't clobber it
  ensureDirs()
  const oldManifest = join(oldRoot, 'pages.json')
  const oldPagesDir = join(oldRoot, 'pages')
  if (existsSync(oldManifest)) writeFileSync(manifestPath(), readFileSync(oldManifest))
  if (existsSync(oldPagesDir)) cpSync(oldPagesDir, pagesDir(), { recursive: true })
}

// One-time upgrade for pages saved under the app's old .txt convention.
let migratedLegacyFiles = false
function migrateLegacyTxtFiles(): void {
  if (migratedLegacyFiles) return
  migratedLegacyFiles = true
  ensureDirs()
  for (const page of readManifest()) {
    const newPath = pagePath(page.id)
    const oldPath = join(pagesDir(), `${page.id}.txt`)
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
  if (!existsSync(manifestPath())) return []
  try {
    const parsed = JSON.parse(readFileSync(manifestPath(), 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeManifest(pages: PageMeta[]): void {
  ensureDirs()
  writeFileSync(manifestPath(), JSON.stringify(pages, null, 2), 'utf-8')
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
  return pagesDir()
}

export function currentPagesRoot(): string {
  return pagesRoot
}

export function relocatePagesRoot(newRoot: string): { ok: true } | { ok: false; reason: string } {
  if (newRoot === pagesRoot) return { ok: false, reason: 'That is already the current location.' }
  const newManifest = join(newRoot, 'pages.json')
  if (existsSync(newManifest)) {
    return { ok: false, reason: 'That folder already contains Calliope pages. Choose an empty folder.' }
  }
  ensureDirs() // make sure the CURRENT location is fully materialized before moving it
  if (!existsSync(newRoot)) mkdirSync(newRoot, { recursive: true })
  const oldPagesDir = pagesDir()
  const oldManifestPath = manifestPath()
  const newPagesDir = join(newRoot, 'pages')
  mkdirSync(newPagesDir, { recursive: true })
  if (existsSync(oldPagesDir)) cpSync(oldPagesDir, newPagesDir, { recursive: true })
  if (existsSync(oldManifestPath)) writeFileSync(newManifest, readFileSync(oldManifestPath))

  if (existsSync(oldPagesDir)) rmSync(oldPagesDir, { recursive: true, force: true })
  if (existsSync(oldManifestPath)) unlinkSync(oldManifestPath)

  pagesRoot = newRoot
  writeFileSync(locationConfigPath, JSON.stringify({ pagesRoot: newRoot }, null, 2), 'utf-8')
  return { ok: true }
}
