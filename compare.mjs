#!/usr/bin/env node

import {
  resolve,
  parse,
  join,
  dirname
} from 'node:path'

import {
  constants,
  accessSync
} from 'node:fs'

import {
  normalisePath
} from '#certificates-library/utils'

import compare from '#certificates-library/compare'

import configMap from '#certificates-library/config'

if (!configMap.has('from')) throw new Error('`from` is required')

const ORIGIN = resolve(normalisePath(configMap.get('from')))
try {
  accessSync(ORIGIN, constants.R_OK | constants.W_OK)
} catch {
  throw new Error(`No \`from\` @ "${ORIGIN}"`)
}

const to = resolve(normalisePath(configMap.get('to') || ORIGIN))
const isDirectory = !parse(to).ext
const DESTINATION = isDirectory ? join(to, 'compare.csv') : to
try {
  accessSync(dirname(DESTINATION), constants.R_OK | constants.W_OK)
} catch {
  throw new Error(`No \`to\` @ "${to}"`)
}

console.log('🚀')
export default (
  compare({
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
