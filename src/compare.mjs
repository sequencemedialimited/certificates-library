import ExifReader from 'exifreader'

import {
  basename,
  join
} from 'node:path'

import { createWriteStream } from 'node:fs'

import {
  readFile,
  glob,
  stat,
  unlink
} from 'node:fs/promises'

import { createObjectCsvStringifier } from 'csv-writer'

import {
  getFileNameSort,
  getEntriesFileNameSort
} from './utils/index.mjs'

const HEADER = [
  { id: 'row', title: 'Row' },
  { id: 'original', title: 'Original' },
  { id: 'duplicate', title: 'Duplicate' },
  { id: 'originalCreateDate', title: 'Original Create Date' },
  { id: 'duplicateCreateDate', title: 'Duplicate Create Date' }
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
   *  @type {Map<string, Date>}
   */
  const fileDatesMap = new Map()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) {
    filePathsSet.add(filePath)

    const {
      CreateDate: {
        value: createDate = null
      } = {}
    } = ExifReader.load(
      await readFile(filePath)
    )

    if (createDate) {
      console.log('Exif')
      fileDatesMap.set(filePath, new Date(createDate))
    } else {
      const {
        birthtimeMs
      } = await stat(filePath)

      if (birthtimeMs) {
        console.log('FS')
        fileDatesMap.set(filePath, new Date(birthtimeMs))
      }
    }
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
              originalCreateDate: fileDatesMap.get(original)?.toISOString() ?? '',
              duplicateCreateDate: fileDatesMap.get(duplicate)?.toISOString() ?? ''
            }
          })), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
