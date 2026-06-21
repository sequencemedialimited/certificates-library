import {
  basename,
  join
} from 'node:path'

import { createWriteStream } from 'node:fs'

import {
  readFile,
  glob,
  unlink
} from 'node:fs/promises'

import { createObjectCsvStringifier } from 'csv-writer'

import {
  getFileDate,
  getFileNameSort,
  getEntriesFileNameSort
} from './utils/index.mjs'

const HEADER = [
  { id: 'row', title: 'Row' },
  { id: 'original', title: 'Original' },
  { id: 'duplicate', title: 'Duplicate' },
  { id: 'originalDate', title: 'Original Date' },
  { id: 'duplicateDate', title: 'Duplicate Date' }
]

/**
 *  @param {{
 *    origin: string,
 *    destination: string
 *  }} params
 */
export default async function compare ({
  origin: ORIGIN,
  destination: DESTINATION
}) {
  try {
    await unlink(DESTINATION)
  } catch (e) {
    if (e instanceof Error) { // @ts-ignore
      const { code } = e
      if (code !== 'ENOENT') throw e
    }
  }

  /**
   *  @type {Set<string>}
   */
  const filePathSet = new Set()

  /**
   *  @type {Map<string, Date | null>}
   */
  const fileDateMap = new Map()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) {
    filePathSet.add(filePath)

    fileDateMap.set(filePath, await getFileDate(filePath))
  }

  if (filePathSet.size) {
    /**
     *  @type {Map<string, Set<string>>}
     */
    const duplicateMap = new Map()

    const originalPaths = Array.from(filePathSet).sort(getFileNameSort(fileDateMap))

    for (const originalPath of originalPaths) {
      const b = basename(originalPath)
      const candidatePaths = originalPaths.filter((candidatePath) => originalPath !== candidatePath && b === basename(candidatePath))

      if (candidatePaths.length) {
        const ALPHA = await readFile(originalPath)

        for (const candidatePath of candidatePaths) {
          const OMEGA = await readFile(candidatePath)

          if (Buffer.compare(ALPHA, OMEGA) === 0) { // equal
            const duplicateSet = duplicateMap.get(originalPath) ?? new Set()
            if (!duplicateMap.has(originalPath)) duplicateMap.set(originalPath, duplicateSet)
            duplicateSet.add(candidatePath)
          }
        }
      }
    }

    const csvStringifier = createObjectCsvStringifier({
      header: HEADER
    })

    const writeStream = createWriteStream(DESTINATION, {
      flags: 'a'
    })

    try {
      await (new Promise((resolve) => {
        writeStream.write(csvStringifier.getHeaderString(), resolve)
      }))

      let i = 0
      for await (const [original, duplicateSet] of Array.from(duplicateMap.entries()).sort(getEntriesFileNameSort(fileDateMap))) {
        await (new Promise((resolve) => {
          writeStream.write(csvStringifier.stringifyRecords(Array.from(duplicateSet).map((duplicate) => {
            return {
              row: ++i,
              original,
              duplicate,
              originalDate: fileDateMap.get(original)?.toISOString() ?? '',
              duplicateDate: fileDateMap.get(duplicate)?.toISOString() ?? ''
            }
          })), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
