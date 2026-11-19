const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** A small "⌘↵" / "Ctrl↵" label for a button. Hidden on touch and phone widths by CSS. */
export function KbdHint() {
  return <kbd className="kbd-hint" aria-hidden="true">{isMac ? '⌘↵' : 'Ctrl↵'}</kbd>;
}
