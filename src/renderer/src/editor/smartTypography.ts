import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view'
import { EditorState, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

// Display-only: renders curly quotes, en/em dashes, and ellipses in place of
// the plain-ASCII characters you actually typed. The document itself never
// changes -- what's on disk is always exactly what you typed, straight
// quotes and all. Same "never mutate, only decorate" rule the rest of
// live-preview follows.
class GlyphWidget extends WidgetType {
  constructor(readonly glyph: string) {
    super()
  }
  eq(other: GlyphWidget): boolean {
    return other.glyph === this.glyph
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = this.glyph
    return span
  }
}

const DASH_ELLIPSIS_RE = /---|--|\.\.\./g
const QUOTE_RE = /["']/g
const OPENING_BEFORE_RE = /[\s([{—–]/

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

function isInCode(state: EditorState, pos: number): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1)
  while (node) {
    if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'CodeText') return true
    node = node.parent
  }
  return false
}

function buildDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = []
  const { state } = view

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = state.doc.lineAt(pos)
      const text = line.text

      DASH_ELLIPSIS_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = DASH_ELLIPSIS_RE.exec(text))) {
        const mFrom = line.from + m.index
        const mTo = mFrom + m[0].length
        if (!touchesSelection(state, mFrom, mTo) && !isInCode(state, mFrom)) {
          const glyph = m[0] === '---' ? '—' : m[0] === '--' ? '–' : '…'
          decos.push(Decoration.replace({ widget: new GlyphWidget(glyph) }).range(mFrom, mTo))
        }
      }

      QUOTE_RE.lastIndex = 0
      while ((m = QUOTE_RE.exec(text))) {
        const idx = m.index
        const mFrom = line.from + idx
        const mTo = mFrom + 1
        if (touchesSelection(state, mFrom, mTo) || isInCode(state, mFrom)) continue
        const prevChar = idx > 0 ? text[idx - 1] : undefined
        const isOpening = prevChar === undefined || OPENING_BEFORE_RE.test(prevChar)
        const glyph = m[0] === '"' ? (isOpening ? '“' : '”') : isOpening ? '‘' : '’'
        decos.push(Decoration.replace({ widget: new GlyphWidget(glyph) }).range(mFrom, mTo))
      }

      pos = line.to + 1
    }
  }

  return Decoration.set(decos, true)
}

const smartTypographyPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

export const smartTypography = [smartTypographyPlugin]
