import type { Register } from 'claude-code'

import { registerDeadlines } from './features/deadlines'
import { registerDocuments } from './features/documents'
import { registerJourney } from './features/journey'
import { registerPipeline } from './features/pipeline'

// One line per feature. Each feature reads its own data (a dossier section or
// tracker.md) and draws with the pieces in ./shared/ui.
export const register: Register = on => {
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
}
