/**
 *  @typedef {import('node:fs').Stats} Stats
 */

import process from 'node:process'

import {
  homedir,
  tmpdir
} from 'node:os'

import {
  join,
  basename
} from 'node:path'

import {
  constants,
  glob,
  mkdtemp,
  mkdir,
  stat,
  access,
  rm
} from 'node:fs/promises'

import {
  STATS,
  LIMIT
} from './defaults.mjs'

/**
 * @param {unknown} v
 */
export async function writeLine (v) {
  const s = String(v)
  await (new Promise((resolve) => stdout.clearLine(0, () => resolve(v))))
  await (new Promise((resolve) => stdout.cursorTo(0, () => resolve(v))))
  await (new Promise((resolve) => stdout.write(s, () => resolve(v))))
}

const {
  stdout
} = process

/**
 * @param {[string, unknown]} alpha
 * @param {[string, unknown]} omega
 * @returns {number}
 */
export function sortEntries ([a], [o]) {
  return a.localeCompare(o)
}

/**
 *  @param {unknown | null} value
 *  @returns {string}
 */
export function normalisePath (value) {
  return String(value ?? '').trim().replace(/^~/, homedir())
}

/**
 *  @param {string} [tmpDir]
 *  @returns {Promise<string>}
 */
export async function createWorkingDir (tmpDir = tmpdir()) {
  return await mkdtemp(join(tmpDir, 'certificates-library-'))
}

/**
 *  @param {string} [tmpDir]
 *  @returns {Promise<void>}
 */
export async function removeWorkingDir (tmpDir = tmpdir()) {
  for await (const workingDir of glob(join(tmpDir, 'certificates-library-*'))) await rm(workingDir, { recursive: true })
}

/**
 *  @param {string} d
 */
export async function createDir (d) {
  try {
    await mkdir(d, { recursive: true })
  } catch {
    throw new Error(`Failed to create "${d}"`)
  }
}

/**
 *  @param {string} f
 */
export async function statFile (f) {
  try {
    await stat(f)
  } catch {
    throw new Error(`No file @ "${f}"`)
  }
}

/**
 *  @param {string} f
 */
export async function accessFile (f) {
  try {
    await access(f, constants.R_OK | constants.W_OK)
  } catch {
    throw new Error(`No file @ "${f}"`)
  }
}

/**
 *  @param {unknown} limit
 *  @returns {number}
 */
export function getLimit (limit = null) {
  if (limit) {
    const n = Number(limit)
    if (!isNaN(n)) return Math.max(0, Math.min(n, LIMIT))
  }

  return LIMIT
}

/**
 *  @param {Map<string, Stats>} statsMap
 *  @return {(alpha: string, omega: string) => number}
 */
export function getFileNameSort (statsMap = new Map()) {
  /**
   *  @param {string} alpha
   *  @param {string} omega
   */
  return function fileNameSort (alpha, omega) {
    const a = basename(alpha)
    const o = basename(omega)

    if (a === o) {
      const { birthtimeMs: a } = statsMap.get(alpha) ?? STATS
      const { birthtimeMs: o } = statsMap.get(omega) ?? STATS

      // Numerical
      return a - o
    }

    // Alphabetical
    return a.localeCompare(o)
  }
}

/**
 *  @param {number} [limit]
 */
export function getFileNameReduce (limit = LIMIT) {
  /**
   *  @param {string[][]} groups
   *  @param {string} filePath
   */
  return function fileNameReduce (
    /**
     *  @type {string[][]}
     */
    groups,
    /**
     *  @type {string}
     */
    filePath
  ) {
    const group = groups.find(getFindFileNameGroup(filePath, limit)) ?? []
    if (!groups.includes(group)) groups.push(group)
    group.push(filePath)
    return groups
  }
}

/**
 *  @param {string} alpha
 *  @returns {(omega: string) => boolean}
 */
export function getFindFileNameMatch (alpha) {
  const a = basename(alpha)

  return function findFileNameMatch (omega) {
    const o = basename(omega)

    return a === o
  }
}

/**
 *  @param {string} fileName
 *  @param {number} [limit]
 *  @returns {(array: string[]) => boolean}
 */
export function getFindFileNameGroup (fileName, limit = LIMIT) {
  return function findFileNameGroup (group) {
    return group.length < limit && !group.some(getFindFileNameMatch(fileName))
  }
}

/**
 *  @param {Set<string>} [pathsSet]
 *  @param {Map<string, Stats>} [statsMap]
 *  @param {number} [limit]
 *  @return {string[][]}
 */
export function getFileNameGroups (pathsSet = new Set(), statsMap = new Map(), limit = LIMIT) {
  return (
    Array
      .from(pathsSet)
      .sort(getFileNameSort(statsMap))
      .reduce(getFileNameReduce(limit), [])
  )
}

/**
 *  @param {string} filePath
 *  @returns {string}
 */
export function toPsdPath (filePath) {
  return filePath.replace(/\/TIF\//, '/PSD/').replace(/\.tif$/, '.psd')
}

/**
 *  @param {string} filePath
 *  @returns {string}
 */
export function toJpgPath (filePath) {
  return filePath.replace(/\/PSD\/(.+)\//, '/PSD/$1/JPG/').replace(/\.psd$/, '.jpg')
}
