#!/usr/bin/env node

import {
  resolve,
  parse,
  join
} from 'node:path'

import {
  constants,
  accessSync,
  statSync
} from 'node:fs'

import {
  normalisePath
} from '#certificates-library/utils'

import validate from '#certificates-library/validate'

import configMap from '#certificates-library/config'

if (!configMap.has('from')) throw new Error('`from` is required')

const ORIGIN = resolve(normalisePath(configMap.get('from')))
try {
  // ensure the path exists
  const stats = statSync(ORIGIN)

  // ensure the path is a directory
  if (!stats.isDirectory()) throw new Error(`Invalid \`from\` @ "${ORIGIN}"`) // caught and rethrown

  // ensure the path is read/writable
  accessSync(ORIGIN, constants.R_OK | constants.W_OK)
} catch {
  throw new Error(`Invalid \`from\` @ "${ORIGIN}"`)
}

const to = resolve(normalisePath(configMap.get('to') || ORIGIN))
let DESTINATION
try {
  // parse the path
  const {
    ext,
    dir
  } = parse(to)

  if (ext) {
    // it's a file
    accessSync(dir, constants.R_OK | constants.W_OK)
    DESTINATION = to
  } else {
    // it's a directory
    accessSync(to, constants.R_OK | constants.W_OK)
    DESTINATION = join(to, 'validate.csv')
  }
} catch {
  throw new Error(`Invalid \`to\` @ "${to}"`)
}

console.log('🚀')
export default (
  validate({
    origin: ORIGIN,
    destination: DESTINATION
  })
    .then(() => {
      console.log('👍')
    })
    .catch(({ message }) => {
      console.error(`💥 ${message}`)
    })
)
