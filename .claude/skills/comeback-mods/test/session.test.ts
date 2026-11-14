import { expect, test } from 'claude-code/testing'

// Regression: the desktop app runs the session with `isInteractive: false`.
// Every feature must still register its command and open its pane there.
test('a non-interactive (desktop/SDK) session opens all five panes and commands', async ($, on) => {
  const opened: string[] = []
  const commands: string[] = []
  on('command.register', (_, e) => {
    commands.push(e.name)

    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: null, isInteractive: false })

  expect(commands).toEqual(['deadlines', 'pipeline', 'documents', 'runway', 'journey'])
  // The last pane opened is the active tab: Твоят път must be last.
  expect(opened).toEqual([
    'comeback-deadlines',
    'comeback-pipeline',
    'comeback-documents',
    'comeback-runway',
    'comeback-journey',
  ])
})
