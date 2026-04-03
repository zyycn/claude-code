import { writeSync as fsWriteSync } from 'fs'

export function writeSync(fd: number, text: string): number {
  return fsWriteSync(fd, text)
}
