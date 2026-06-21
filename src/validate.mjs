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
  getFileDate,
  toPsdPath,
  toJpgPath,
  accessFile,
  getEntriesFileNameSort
} from './utils/index.mjs'

const HEADER = [
  { id: 'row', title: 'Row' },
  { id: 'tif', title: 'TIF' },
  { id: 'psd', title: 'PSD' },
  { id: 'jpg', title: 'JPG' },
  { id: 'createDate', title: 'Create Date' }
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
     *  @type {Map<string, Map<'psd' | 'jpg', string>>}
     */
    const exceptionsMap = new Map()

    for (const filePath of filePathSet) {
      const psd = toPsdPath(filePath)
      const jpg = toJpgPath(toPsdPath(filePath))

      try {
        await accessFile(psd)
      } catch {
        const exceptions = exceptionsMap.get(filePath) ?? new Map()
        if (!exceptionsMap.has(filePath)) exceptionsMap.set(filePath, exceptions)
        exceptions.set('psd', psd)
      }

      try {
        await accessFile(jpg)
      } catch {
        const exceptions = exceptionsMap.get(filePath) ?? new Map()
        if (!exceptionsMap.has(filePath)) exceptionsMap.set(filePath, exceptions)
        exceptions.set('jpg', jpg)
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
      for await (const [tif, exceptions] of Array.from(exceptionsMap.entries()).sort(getEntriesFileNameSort(fileDateMap))) {
        await (new Promise((resolve) => {
          writeStream.write(csvStringifier.stringifyRecords([{
            row: ++i,
            tif,
            psd: exceptions.get('psd') ?? '',
            jpg: exceptions.get('jpg') ?? '',
            createDate: fileDateMap.get(tif)?.toISOString() ?? ''
          }]), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
