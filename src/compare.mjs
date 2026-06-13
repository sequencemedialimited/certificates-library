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

const HEADER = [
  { id: 'row', title: 'Row' },
  { id: 'original', title: 'Original' },
  { id: 'duplicate', title: 'Duplicate' }
]

/**
 *  @param {{
 *    origin: string,
 *    destination: string
 *  }} params
 */
export default async function validate ({
  origin: ORIGIN,
  destination: DESTINATION
}) {
  try {
    await unlink(DESTINATION)
  } catch (e) {
    if (e instanceof Error) { // @ts-ignore
      const { code } = e
      if (code !== 'ENOENT') {
        const { message } = e
        console.error(message)
      }
    }
  }

  /**
   *  @type {Set<string>}
   */
  const filePathsSet = new Set()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) filePathsSet.add(filePath)

  if (filePathsSet.size) {
    /**
     *  @type {Map<string, Set<string>>}
     */
    const duplicatesMap = new Map()

    const originals = Array.from(filePathsSet)

    for (const originalPath of originals) {
      const b = basename(originalPath)
      const candidates = originals.filter((candidatePath) => originalPath !== candidatePath && b === basename(candidatePath))

      if (candidates.length) {
        const ALPHA = await readFile(originalPath)

        for (const candidatePath of candidates) {
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
      writeStream.write(csvStringifier.getHeaderString())

      let i = 0
      for await (const [original, duplicates] of duplicatesMap.entries()) {
        await (new Promise((resolve) => {
          writeStream.write(csvStringifier.stringifyRecords(Array.from(duplicates).map((duplicate) => {
            return {
              row: ++i,
              original,
              duplicate
            }
          })), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
