import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Matches the UI chrome's font exactly (see style.css's body rule) so the
// editor content and the surrounding sidebar/buttons/status bar read as one
// typeface rather than two competing ones.
const proseFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif'
const monoFont = '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace'

const shared = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '18px'
  },
  '.cm-scroller': {
    fontFamily: proseFont,
    lineHeight: '1.65',
    fontKerning: 'normal',
    fontVariantLigatures: 'common-ligatures',
    textRendering: 'optimizeLegibility',
    overflowY: 'auto'
  },
  '.cm-content': {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '14vh 32px 50vh',
    caretColor: 'var(--ink-caret)'
  },
  '.cm-line': {
    padding: '0',
    transition: 'opacity 150ms ease'
  },
  '.cm-focus-dim': {
    opacity: '0.3'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-gutters': {
    display: 'none'
  },
  '.cm-heading': {
    fontWeight: '700'
  },
  '.cm-heading-1': { fontSize: '1.7em', lineHeight: '1.15', letterSpacing: '-0.015em' },
  '.cm-heading-2': { fontSize: '1.4em', lineHeight: '1.2', letterSpacing: '-0.012em' },
  '.cm-heading-3': { fontSize: '1.2em', lineHeight: '1.25', letterSpacing: '-0.008em' },
  '.cm-heading-4': { fontSize: '1.05em', lineHeight: '1.3', letterSpacing: '-0.004em' },
  '.cm-heading-5': { fontSize: '1em', lineHeight: '1.35', opacity: '0.85' },
  '.cm-heading-6': { fontSize: '0.95em', lineHeight: '1.35', opacity: '0.75' },
  '.cm-strong': { fontWeight: '700' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strike': { textDecoration: 'line-through' },
  '.cm-inline-code, .cm-code-block-line': {
    fontFamily: monoFont,
    fontSize: '0.88em'
  },
  '.cm-inline-code': {
    background: 'var(--ink-code-bg)',
    borderRadius: '4px',
    padding: '0.1em 0.3em'
  },
  '.cm-code-block-line': {
    background: 'var(--ink-code-bg)'
  },
  '.cm-markup-dim': {
    opacity: '0.4'
  },
  '.cm-quote-line': {
    borderLeft: '3px solid var(--ink-muted)',
    paddingLeft: '14px',
    color: 'var(--ink-muted)',
    fontStyle: 'italic'
  },
  '.cm-quote-mark': {
    color: 'var(--ink-muted)'
  },
  '.cm-list-mark': {
    color: 'var(--ink-accent)'
  },
  '.cm-task-marker': {
    fontFamily: monoFont,
    color: 'var(--ink-accent)'
  },
  '.cm-link-text': {
    color: 'var(--ink-accent)',
    fontWeight: '600',
    textDecoration: 'underline',
    textDecorationColor: 'var(--ink-accent-faint)'
  },
  '.cm-hr-line': {
    position: 'relative',
    height: '1.75em'
  },
  '.cm-hr-line::before': {
    content: '""',
    position: 'absolute',
    left: '0',
    right: '0',
    top: '50%',
    borderTop: '1px solid var(--ink-muted)'
  },
  '&.cm-editor .cm-selectionBackground': {
    background: 'var(--ink-selection) !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--ink-caret)'
  }
})

// A restrained take on E Ink Carta's matte, colorless display rather than a
// literal simulation (no dithering, no refresh flash) — desaturated grays,
// higher text contrast than the old warm-paper theme, links/markers carried
// by weight and underline instead of color since e-ink has none.
const einkVars = EditorView.theme({
  '&': {
    '--ink-caret': '#232320',
    '--ink-muted': '#7c7a74',
    '--ink-accent': '#3a3935',
    '--ink-accent-faint': 'rgba(58, 57, 53, 0.45)',
    '--ink-code-bg': 'rgba(40, 39, 35, 0.07)',
    '--ink-selection': 'rgba(40, 39, 35, 0.14)',
    backgroundColor: '#f1f0eb',
    color: '#232320'
  }
})

const darkVars = EditorView.theme(
  {
    '&': {
      '--ink-caret': '#e8e6df',
      '--ink-muted': '#8b8878',
      '--ink-accent': '#e0a973',
      '--ink-accent-faint': 'rgba(224, 169, 115, 0.4)',
      '--ink-code-bg': 'rgba(255, 255, 255, 0.07)',
      '--ink-selection': 'rgba(224, 169, 115, 0.2)',
      backgroundColor: '#1e1e1c',
      color: '#e8e6df'
    }
  },
  { dark: true }
)

const highlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.meta, color: 'var(--ink-muted)' },
    { tag: t.monospace, fontFamily: monoFont },
    { tag: t.url, color: 'var(--ink-accent)' },
    { tag: t.processingInstruction, color: 'var(--ink-muted)' }
  ])
)

export const einkTheme = [shared, einkVars, highlightStyle]
export const darkTheme = [shared, darkVars, highlightStyle]
