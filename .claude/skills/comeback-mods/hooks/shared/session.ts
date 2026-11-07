import type { Hook } from 'claude-code'

// The engine allows ONE unmatched hook per event per plugin, so session.start is
// registered once, in register.tsx, and calls each feature's `start<Name>($)`.
// No feature may add its own session.start hook. Do not gate it on
// `isInteractive`: the desktop app and the SDK run with `isInteractive: false`,
// and a gated hook never runs there (no pane, no slash command).

/** The `$` a session.start hook receives. */
export type StartApi = Parameters<Hook<'session.start'>>[0]
