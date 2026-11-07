// The status line is ONE slot per plugin (`$.ui.status`). Features must not
// write it directly or they clobber each other; each owns a named segment here
// and this module composes the non-empty segments, in a fixed order, into the slot.

/** Left-to-right order of the segments. Add a feature's key here. */
const ORDER = ['deadlines', 'journey', 'pipeline', 'documents', 'runway'] as const

const segments = new Map<string, string>()

/** Sets (or, with `undefined`, clears) one segment and redraws the shared status line. */
export function setStatusSegment(
  $: { ui: { status: (text: string | undefined) => void } },
  key: string,
  text: string | undefined,
): void {
  if (text === undefined || text === '') {
    segments.delete(key)
  } else {
    segments.set(key, text)
  }
  const composed = ORDER.map(k => segments.get(k))
    .filter((s): s is string => s !== undefined)
    .join(' · ')
  $.ui.status(composed === '' ? undefined : composed)
}
