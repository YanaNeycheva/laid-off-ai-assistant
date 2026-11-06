import type { Register } from 'claude-code'

import { registerDeadlines } from './features/deadlines'

// One line per feature. Each feature reads its own dossier section through
// ./shared/dossier and draws with the pieces in ./shared/ui.
export const register: Register = on => {
  registerDeadlines(on)
}
