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
  const filePathsSet = new Set()

  /**
   *  @type {Map<string, Date | null>}
   */
  const fileDatesMap = new Map()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) {
    filePathsSet.add(filePath)

    fileDatesMap.set(filePath, await getFileDate(filePath))
  }

  if (filePathsSet.size) {
    /**
     *  @type {Map<string, Set<string>>}
     */
    const duplicatesMap = new Map()

    const originalPaths = Array.from(filePathsSet).sort(getFileNameSort(fileDatesMap))

    for (const originalPath of originalPaths) {
      const b = basename(originalPath)
      const candidatePaths = originalPaths.filter((candidatePath) => originalPath !== candidatePath && b === basename(candidatePath))

      if (candidatePaths.length) {
        const ALPHA = await readFile(originalPath)

        for (const candidatePath of candidatePaths) {
          const OMEGA = await readFile(candidatePath)

          if (Buffer.compare(ALPHA, OMEGA) === 0) { // equal
            const duplicates = duplicatesMap.get(originalPath) ?? new Set()
            if (!duplicatesMap.has(originalPath)) duplicatesMap.set(originalPath, duplicates)
            duplicates.add(candidatePath)
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
      for await (const [original, duplicates] of Array.from(duplicatesMap.entries()).sort(getEntriesFileNameSort(fileDatesMap))) {
        await (new Promise((resolve) => {
          writeStream.write(csvStringifier.stringifyRecords(Array.from(duplicates).map((duplicate) => {
            return {
              row: ++i,
              original,
              duplicate,
              originalDate: fileDatesMap.get(original)?.toISOString() ?? '',
              duplicateDate: fileDatesMap.get(duplicate)?.toISOString() ?? ''
            }
          })), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
