import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { EditorState, Range, StateField, StateEffect } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

const HEADING_NODES = new Set(['ATXHeading1', 'ATXHeading2', 'ATXHeading3', 'ATXHeading4', 'ATXHeading5', 'ATXHeading6'])
const EMPHASIS_NODES: Record<string, { mark: string; class: string }> = {
  StrongEmphasis: { mark: 'EmphasisMark', class: 'cm-strong' },
  Emphasis: { mark: 'EmphasisMark', class: 'cm-em' },
  Strikethrough: { mark: 'StrikethroughMark', class: 'cm-strike' },
  InlineCode: { mark: 'CodeMark', class: 'cm-inline-code' }
}

// Permanently reveals markup (the </> toggle) instead of only showing it on
// the line the cursor is touching.
export const toggleShowMarkupEffect = StateEffect.define<boolean>()

export const showMarkupField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleShowMarkupEffect)) value = effect.value
    }
    return value
  }
})

export function toggleShowMarkup(view: EditorView): boolean {
  const next = !view.state.field(showMarkupField)
  view.dispatch({ effects: toggleShowMarkupEffect.of(next) })
  return next
}

function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

function isRevealed(state: EditorState, from: number, to: number): boolean {
  return state.field(showMarkupField) || touchesSelection(state, from, to)
}

function hideOrDim(decos: Range<Decoration>[], mark: SyntaxNode, focused: boolean): void {
  if (mark.from === mark.to) return
  if (focused) {
    decos.push(Decoration.mark({ class: 'cm-markup-dim' }).range(mark.from, mark.to))
  } else {
    decos.push(Decoration.replace({}).range(mark.from, mark.to))
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = []
  const { state } = view

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (ref) => {
        const name = ref.name

        if (HEADING_NODES.has(name)) {
          const level = Number(name.slice(-1))
          const node = ref.node
          decos.push(Decoration.mark({ class: `cm-heading cm-heading-${level}` }).range(node.from, node.to))
          const mark = node.getChild('HeaderMark')
          if (mark) {
            const focused = isRevealed(state, node.from, node.to)
            if (focused) {
              decos.push(Decoration.mark({ class: 'cm-markup-dim' }).range(mark.from, mark.to))
            } else {
              const contentStart = mark.nextSibling?.from ?? mark.to
              decos.push(Decoration.replace({}).range(mark.from, Math.min(contentStart, node.to)))
            }
          }
          return
        }

        const emphasis = EMPHASIS_NODES[name]
        if (emphasis) {
          const node = ref.node
          decos.push(Decoration.mark({ class: emphasis.class }).range(node.from, node.to))
          const focused = isRevealed(state, node.from, node.to)
          for (const mark of node.getChildren(emphasis.mark)) hideOrDim(decos, mark, focused)
          return
        }

        if (name === 'Link') {
          const node = ref.node
          const marks = node.getChildren('LinkMark')
          const url = node.getChild('URL')
          const focused = isRevealed(state, node.from, node.to)
          decos.push(Decoration.mark({ class: 'cm-link-text' }).range(node.from, node.to))
          if (marks.length >= 2) {
            if (focused) {
              for (const m of marks) decos.push(Decoration.mark({ class: 'cm-markup-dim' }).range(m.from, m.to))
              if (url) decos.push(Decoration.mark({ class: 'cm-markup-dim' }).range(url.from, url.to))
            } else {
              decos.push(Decoration.replace({}).range(marks[0].from, marks[0].to))
              decos.push(Decoration.replace({}).range(marks[1].from, node.to))
            }
          }
          return
        }

        if (name === 'QuoteMark') {
          decos.push(Decoration.mark({ class: 'cm-quote-mark' }).range(ref.from, ref.to))
          return
        }

        if (name === 'Blockquote') {
          const startLine = state.doc.lineAt(ref.from).number
          const endLine = state.doc.lineAt(ref.to).number
          for (let ln = startLine; ln <= endLine; ln++) {
            decos.push(Decoration.line({ class: 'cm-quote-line' }).range(state.doc.line(ln).from))
          }
          return
        }

        if (name === 'FencedCode') {
          const startLine = state.doc.lineAt(ref.from).number
          const endLine = state.doc.lineAt(ref.to).number
          for (let ln = startLine; ln <= endLine; ln++) {
            decos.push(Decoration.line({ class: 'cm-code-block-line' }).range(state.doc.line(ln).from))
          }
          return
        }

        if (name === 'HorizontalRule') {
          const line = state.doc.lineAt(ref.from)
          const focused = isRevealed(state, line.from, line.to)
          if (focused) {
            decos.push(Decoration.mark({ class: 'cm-markup-dim' }).range(ref.from, ref.to))
          } else {
            decos.push(Decoration.line({ class: 'cm-hr-line' }).range(line.from))
            decos.push(Decoration.replace({}).range(ref.from, ref.to))
          }
          return
        }

        if (name === 'ListMark') {
          decos.push(Decoration.mark({ class: 'cm-list-mark' }).range(ref.from, ref.to))
          return
        }

        if (name === 'TaskMarker') {
          decos.push(Decoration.mark({ class: 'cm-task-marker' }).range(ref.from, ref.to))
        }
      }
    })
  }

  return Decoration.set(decos, true)
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.startState.field(showMarkupField) !== update.state.field(showMarkupField)
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

export const livePreview = [showMarkupField, livePreviewPlugin]
