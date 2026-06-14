/**
 *  @typedef {import('node:fs').Stats} Stats
 */

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
  lstat,
  access,
  rm
} from 'node:fs/promises'

import {
  STATS,
  LIMIT
} from './defaults.mjs'

/**
 *  @param {unknown | null} value
 *  @returns {string}
 */
export function normalisePath (value) {
  return String(value ?? '').trim().replace(/^~/, homedir())
}

export async function createWorkingDir (tmpDir = tmpdir()) {
  return await mkdtemp(join(tmpDir, 'certificates-library-'))
}

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
export async function lstatFile (f) {
  try {
    await lstat(f)
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
 *  @param {string[]} array
 *  @param {number} limit
 *//*
export function * getBatch (array, limit = LIMIT) {
  for (let i = 0; i < array.length; i += limit) yield array.slice(i, i + limit)
} */

/**
 *  @param {Map<string, Stats>} statsMap
 *  @return {(alpha: string, omega: string) => number}
 */
export function getFilePathSort (statsMap = new Map()) {
  /**
   *  @param {string} alpha
   *  @param {string} omega
   */
  return function sort (alpha, omega) {
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
 *  @param {string} alpha
 *  @returns {(omega: string) => boolean}
 */
export const getFindFileNameMatch = (alpha) => (omega) => basename(alpha) === basename(omega)

/**
 *  @param {string[]} array
 *  @returns {(alpha: string, i: number) => boolean}
 *//*
export const getFilterToIncludeFileNameDuplicatesFrom = (array) => (alpha, i) => i !== array.findIndex(getFindFileNameMatch(alpha)) */

/**
 *  @param {string[]} array
 *  @returns {(alpha: string, i: number) => boolean}
 *//*
export const getFilterToExcludeFileNameDuplicatesFrom = (array) => (alpha, i) => i === array.findIndex(getFindFileNameMatch(alpha)) */

/**
 *  @param {string[]} array
 *  @returns {boolean}
 *//*
export const hasFileNameDuplicatesIn = (array) => ((new Set(array.map((value) => basename(value)))).size !== array.length) */

/**
 *  @param {string} fileName
 *  @param {[string[]]} array
 *  @returns {boolean}
 *//*
export const hasFileNameDuplicateIn = (fileName, array) => array.some((array) => array.some(getFindFileNameMatch(fileName))) */

/**
 *  @param {string} value
 *  @param {number} limit
 *  @returns {(array: string[]) => boolean}
 */
export const getFindFileNameGroup = (value, limit = LIMIT) => (array) => array.length < limit && !array.some(getFindFileNameMatch(value))

/**
 *  @param {Set<string>} pathsSet
 *  @param {Map<string, Stats>} statsMap
 *  @param {number} limit
 *  @return {string[][]}
 */
export function getFileNameGroups (pathsSet, statsMap, limit = LIMIT) {
  return (
    Array
      .from(pathsSet)
      .sort(getFilePathSort(statsMap))
      .reduce((
        /**
         *  @type {string[][]}
         */
        accumulator,
        /**
         *  @type {string}
         */
        filePath
      ) => {
        const fileNameGroup = accumulator.find(getFindFileNameGroup(filePath, limit)) ?? []
        if (!accumulator.includes(fileNameGroup)) accumulator.push(fileNameGroup)
        fileNameGroup.push(filePath)
        return accumulator
      }, [])
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
