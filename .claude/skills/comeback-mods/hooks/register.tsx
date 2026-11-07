import type { Register } from 'claude-code'

import { registerDeadlines, startDeadlines } from './features/deadlines'
import { registerDocuments, startDocuments } from './features/documents'
import { registerJourney, startJourney } from './features/journey'
import { registerPipeline, startPipeline } from './features/pipeline'
import { registerRunway, startRunway } from './features/runway'

// One line per feature. Each feature reads its own data (a dossier section or
// tracker.md) and draws with the pieces in ./shared/ui.
export const register: Register = on => {
  // Every feature's slash command and pane, opened once per session. One hook for
  // the whole plugin (one unmatched hook per event), and deliberately NOT gated on
  // `isInteractive`: the desktop app runs with it false (see shared/session.ts).
  on('session.start', async ($, e, next) => {
    await startDeadlines($)
    await startJourney($)
    await startPipeline($)
    await startDocuments($)
    await startRunway($)

    return next(e)
  })

  // Redraw every pane around each turn (the dossier changes while the assistant
  // works). Registered once for the whole plugin: the engine allows only ONE
  // unmatched hook per event per plugin, so no feature may add its own
  // prompt.submit / turn.complete hook.
  on('prompt.submit', ($, e, next) => {
    $.ui.invalidate('ui.render')

    return next(e)
  })
  on('turn.complete', ($, e, next) => {
    $.ui.invalidate('ui.render')

    return next(e)
  })

  registerDeadlines(on)
  registerJourney(on)
  registerPipeline(on)
  registerDocuments(on)
  registerRunway(on)
}
