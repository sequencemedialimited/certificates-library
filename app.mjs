#!/usr/bin/env node

import {
  resolve
} from 'node:path'

import { lstatSync } from 'node:fs'

import {
  normalisePath,
  createWorkingDir,
  removeWorkingDir,
  getLimit
} from '#certificates-library/utils'

import library from '#certificates-library/library'

import configMap from '#certificates-library/config'

if (!configMap.has('from')) throw new Error('`from` is required')

const ORIGIN = resolve(normalisePath(configMap.get('from')))
try {
  lstatSync(ORIGIN)
} catch {
  throw new Error(`No \`from\` @ "${ORIGIN}"`)
}

const DESTINATION = resolve(normalisePath(configMap.get('to') || ORIGIN))
try {
  lstatSync(DESTINATION)
} catch {
  throw new Error(`No \`to\` @ "${DESTINATION}"`)
}

const LIMIT = getLimit(configMap.get('limit'))

/**
 *  @param {string} workingDir
 *  @returns {Promise<void>}
 */
async function execute (workingDir) {
  await library(workingDir, {
    origin: ORIGIN,
    limit: LIMIT,
    destination: DESTINATION
  })
}

console.log('🚀')
export default (
  createWorkingDir()
    .then(execute)
    .then(() => {
      console.log('👍')
    })
    .catch(({ message }) => {
      console.error(`💥 ${message}`)
    })
    .finally(removeWorkingDir)
)
