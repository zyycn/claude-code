import type { Command } from '../../commands.js'

const permission = {
  type: 'local-jsx',
  name: 'permission',
  description: 'Switch between Default and Full Access permission modes',
  load: () => import('./permission.js'),
} satisfies Command

export default permission
