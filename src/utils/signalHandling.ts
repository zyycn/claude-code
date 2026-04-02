import { gracefulShutdownSync } from './gracefulShutdown.js'

export function handleMainSigint(
  argv: string[] = process.argv,
  shutdown: (exitCode?: number) => void = gracefulShutdownSync,
): void {
  if (argv.includes('-p') || argv.includes('--print')) {
    return
  }

  shutdown(0)
}
