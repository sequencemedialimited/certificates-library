import { argv } from 'node:process'

import yargsParser from 'yargs-parser'

export default new Map(Object.entries(yargsParser(argv.slice(2))))
