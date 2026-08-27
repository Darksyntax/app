export interface ToastOptions {
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

const DEFAULT_DURATION = 6000

let toastEl: HTMLDivElement | null = null
let messageEl: HTMLSpanElement | null = null
let actionEl: HTMLButtonElement | null = null
let hideTimer: number | undefined

function ensureToastEl(): void {
  if (toastEl) return
  toastEl = document.createElement('div')
  toastEl.id = 'toast'
  messageEl = document.createElement('span')
  messageEl.className = 'toast-message'
  actionEl = document.createElement('button')
  actionEl.type = 'button'
  actionEl.className = 'toast-action'
  toastEl.append(messageEl, actionEl)
  document.body.appendChild(toastEl)
}

function hideToast(): void {
  if (hideTimer !== undefined) {
    window.clearTimeout(hideTimer)
    hideTimer = undefined
  }
  toastEl?.classList.remove('visible')
}

export function showToast(message: string, options: ToastOptions = {}): void {
  ensureToastEl()
  if (hideTimer !== undefined) window.clearTimeout(hideTimer)

  messageEl!.textContent = message
  if (options.actionLabel && options.onAction) {
    const onAction = options.onAction
    actionEl!.textContent = options.actionLabel
    actionEl!.classList.remove('hidden')
    actionEl!.onclick = () => {
      hideToast()
      onAction()
    }
  } else {
    actionEl!.classList.add('hidden')
    actionEl!.onclick = null
  }

  toastEl!.classList.add('visible')
  hideTimer = window.setTimeout(hideToast, options.duration ?? DEFAULT_DURATION)
}
