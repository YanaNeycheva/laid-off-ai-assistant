// Shared drawing pieces for every comeback feature (card, pill, meter, pane
// header, band). The look follows mod-mockups/shared.css. Each helper takes the
// element table from `$.ui.resolve(e)`, because elements are per surface.
//
// Motion: the same elements and animations for everyone; nothing here reads a
// motion preference (project rule). The terminal cannot animate, so it draws
// the static bar; that is a surface limit, not a preference.

import type { Elements, RenderChildren, RenderSurface } from 'claude-code'

export type UiTable = Elements[RenderSurface]

/** Meaning of a color. Maps to the mockup's --ok / --warn / --bad / --info. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'violet'

export const COLORS = {
  text: '#e8e6e3',
  muted: '#9a978f',
  dim: '#6b6963',
  ok: '#6fbf73',
  warn: '#e0b04a',
  bad: '#e06c5a',
  info: '#6aa7e0',
  violet: '#a58be0',
  track: '#2a2a2f',
  card: '#232327',
  line: '#2e2e33',
  warnBg: '#3a2f17',
  warnLine: '#6b5524',
  badBg: '#3a1d19',
  badLine: '#7a3a30',
} as const

export function toneColor(tone: Tone): string {
  switch (tone) {
    case 'ok':
      return COLORS.ok
    case 'warn':
      return COLORS.warn
    case 'bad':
      return COLORS.bad
    case 'info':
      return COLORS.info
    case 'violet':
      return COLORS.violet
    default:
      return COLORS.muted
  }
}

/** Pane title row: bold title, dim note on the right (`3 активни`). */
export function paneHeader(t: UiTable, title: string, note?: string) {
  const { Box, Text } = t

  return (
    <Box justifyContent="space-between">
      <Text weight="semibold">{title}</Text>
      {note !== undefined ? <Text dimColor>{note}</Text> : null}
    </Box>
  )
}

/** A bordered card. `tone` tints the border for warn / bad. */
export function card(t: UiTable, tone: Tone, children: RenderChildren) {
  const { Box } = t
  const borderColor =
    tone === 'warn' ? COLORS.warnLine : tone === 'bad' ? COLORS.badLine : COLORS.line

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      {children}
    </Box>
  )
}

/** A small label: `5 дни`, `за проверка`. */
export function pill(t: UiTable, text: string, tone: Tone) {
  const { Text } = t

  return (
    <Text color={toneColor(tone)} weight="semibold">
      {text}
    </Text>
  )
}

/** A dim group label above a list (`Базово CV`). */
export function groupLabel(t: UiTable, text: string) {
  const { Text } = t

  return (
    <Text dimColor weight="semibold">
      {text}
    </Text>
  )
}

/**
 * A list row: icon, name, optional pill, and a right-aligned dim note (a date).
 * `dim` greys the name; `hint` is a dim second line (a path).
 */
export function iconRow(
  t: UiTable,
  opts: { icon: string; name: string; pill?: { text: string; tone: Tone }; note?: string; dim?: boolean; hint?: string },
) {
  const { Box, Text } = t

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" gap={1}>
        <Box gap={1}>
          <Text>{opts.icon}</Text>
          <Text dimColor={opts.dim === true}>{opts.name}</Text>
          {opts.pill === undefined ? null : pill(t, opts.pill.text, opts.pill.tone)}
        </Box>
        {opts.note === undefined ? null : <Text dimColor>{opts.note}</Text>}
      </Box>
      {opts.hint === undefined ? null : <Text dimColor>{opts.hint}</Text>}
    </Box>
  )
}

/** SMIL opacity pulse shared by every pulsing SVG (meter at `bad`, current journey stage). */
export const PULSE_SMIL =
  '<animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite"/>'

/**
 * A horizontal meter filled to `fraction` (0..1). On the graphical surfaces it
 * grows in and, at `bad`, pulses (SMIL, like the mockup's grow-in / pulse). The
 * terminal draws a plain filled bar.
 */
export function meter(
  t: UiTable,
  opts: { fraction: number; tone: Tone; columns: number },
) {
  const { Box } = t
  const fraction = Math.max(0, Math.min(1, opts.fraction))
  const color = toneColor(opts.tone === 'neutral' ? 'ok' : opts.tone)

  if ('Svg' in t) {
    const { Svg } = t
    const fill = Math.round(fraction * 100)
    const pulse = opts.tone === 'bad' ? PULSE_SMIL : ''
    const source =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 8" preserveAspectRatio="none">` +
      `<rect width="100" height="8" rx="4" fill="${COLORS.track}"/>` +
      `<rect width="${fill}" height="8" rx="4" fill="${color}">` +
      `<animate attributeName="width" from="0" to="${fill}" dur="1.2s" fill="freeze"/>${pulse}</rect></svg>`

    return (
      <Svg
        source={source}
        alt={`${fill}%`}
        width={Math.max(40, opts.columns * 8)}
        height={8}
        isInteractive
      />
    )
  }

  const cells = Math.max(4, opts.columns)
  const filled = Math.round(fraction * cells)

  return (
    <Box width={cells} height={1} backgroundColor={COLORS.track}>
      <Box width={filled} height={1} backgroundColor={color} />
    </Box>
  )
}

/**
 * A horizontal bar split into side-by-side segments (fractions of the whole,
 * summing to at most 1). Graphical surfaces grow each segment in (SMIL); the
 * terminal draws a row of coloured boxes.
 */
export function stackedMeter(
  t: UiTable,
  opts: { segments: Array<{ fraction: number; tone: Tone }>; columns: number },
) {
  const { Box } = t
  const parts = opts.segments.map(s => ({
    fraction: Math.max(0, Math.min(1, s.fraction)),
    color: toneColor(s.tone === 'neutral' ? 'ok' : s.tone),
  }))

  if ('Svg' in t) {
    const { Svg } = t
    let x = 0
    let rects = ''
    for (const p of parts) {
      const w = Math.round(p.fraction * 1000) / 10
      rects +=
        `<rect x="${x}" width="${w}" height="8" fill="${p.color}">` +
        `<animate attributeName="width" from="0" to="${w}" dur="1.2s" fill="freeze"/></rect>`
      x += w
    }
    const source =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 8" preserveAspectRatio="none">` +
      `<rect width="100" height="8" rx="4" fill="${COLORS.track}"/>${rects}</svg>`

    return (
      <Svg
        source={source}
        alt={parts.map(p => `${Math.round(p.fraction * 100)}%`).join(' / ')}
        width={Math.max(40, opts.columns * 8)}
        height={8}
        isInteractive
      />
    )
  }

  const cells = Math.max(4, opts.columns)
  let used = 0
  let sum = 0

  return (
    <Box width={cells} height={1} backgroundColor={COLORS.track}>
      {parts.map(p => {
        sum += p.fraction
        const end = Math.round(sum * cells)
        const width = Math.max(0, end - used)
        used = end

        return <Box width={width} height={1} backgroundColor={p.color} />
      })}
    </Box>
  )
}

/** Rows of colour swatch, label and a right-aligned dim value (`2 м.`). */
export function legend(
  t: UiTable,
  rows: Array<{ tone: Tone; label: string; value: string }>,
) {
  const { Box, Text } = t

  return (
    <Box flexDirection="column">
      {rows.map(r => (
        <Box justifyContent="space-between" gap={1}>
          <Box gap={1}>
            <Text color={toneColor(r.tone)}>■</Text>
            <Text>{r.label}</Text>
          </Box>
          <Text dimColor>{r.value}</Text>
        </Box>
      ))}
    </Box>
  )
}

/** The band above the prompt. Tint follows `tone`; `children` are Text nodes. */
export function band(t: UiTable, tone: Tone, children: RenderChildren) {
  const { Box } = t
  const backgroundColor =
    tone === 'warn' ? COLORS.warnBg : tone === 'bad' ? COLORS.badBg : COLORS.card

  return (
    <Box backgroundColor={backgroundColor} paddingX={1} gap={1}>
      {children}
    </Box>
  )
}
