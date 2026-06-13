#!/usr/bin/env node

import {
  resolve,
  parse,
  join
} from 'node:path'

import { lstatSync } from 'node:fs'

import {
  normalisePath
} from '#certificates-library/utils'

import validate from '#certificates-library/validate'

import configMap from '#certificates-library/config'

if (!configMap.has('from')) throw new Error('`from` is required')

const ORIGIN = resolve(normalisePath(configMap.get('from')))
try {
  lstatSync(ORIGIN)
} catch {
  throw new Error(`No \`from\` @ "${ORIGIN}"`)
}

const to = resolve(normalisePath(configMap.get('to') || ORIGIN))
try {
  lstatSync(to)
} catch {
  throw new Error(`No \`to\` @ "${to}"`)
}

const isDirectory = !parse(to).ext
const DESTINATION = isDirectory ? join(to, 'validate.csv') : to

console.log('🚀')
export default (
  validate({ origin: ORIGIN, destination: DESTINATION })
    .then(() => {
      console.log('👍')
    })
    .catch(({ message }) => {
      console.error(`💥 ${message}`)
    })
)
