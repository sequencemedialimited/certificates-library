import {
  join
} from 'node:path'

import { createWriteStream } from 'node:fs'

import {
  glob,
  unlink
} from 'node:fs/promises'

import { createObjectCsvStringifier } from 'csv-writer'

import {
  toPsdPath,
  toJpgPath,
  lstatFile
} from './utils/index.mjs'

const HEADER = [
  { id: 'row', title: 'Row' },
  { id: 'tif', title: 'TIF' },
  { id: 'psd', title: 'PSD' },
  { id: 'jpg', title: 'JPG' }
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
     *  @type {Map<string, Map<'psd' | 'jpg', string>>}
     */
    const errorsMap = new Map()

    for (const filePath of filePathsSet) {
      const psd = toPsdPath(filePath)
      const jpg = toJpgPath(toPsdPath(filePath))

      try {
        await lstatFile(psd)
      } catch {
        const errorMap = errorsMap.get(filePath) ?? new Map()
        if (!errorsMap.has(filePath)) errorsMap.set(filePath, errorMap)
        errorMap.set('psd', psd)
      }

      try {
        await lstatFile(jpg)
      } catch {
        const errorMap = errorsMap.get(filePath) ?? new Map()
        if (!errorsMap.has(filePath)) errorsMap.set(filePath, errorMap)
        errorMap.set('jpg', jpg)
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
      for await (const [tif, errorMap] of errorsMap.entries()) {
        await (new Promise((resolve) => {
          const row = ++i
          writeStream.write(csvStringifier.stringifyRecords([{
            row,
            tif,
            psd: errorMap.get('psd') ?? '',
            jpg: errorMap.get('jpg') ?? ''
          }]), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
