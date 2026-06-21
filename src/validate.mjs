import ExifReader from 'exifreader'

import {
  join
} from 'node:path'

import { createWriteStream } from 'node:fs'

import {
  glob,
  stat,
  unlink,
  readFile
} from 'node:fs/promises'

import { createObjectCsvStringifier } from 'csv-writer'

import {
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
     *  @type {Map<string, Map<'psd' | 'jpg', string>>}
     */
    const exceptionsMap = new Map()

    for (const filePath of filePathsSet) {
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
      for await (const [tif, exceptions] of Array.from(exceptionsMap.entries()).sort(getEntriesFileNameSort(fileDatesMap))) {
        await (new Promise((resolve) => {
          writeStream.write(csvStringifier.stringifyRecords([{
            row: ++i,
            tif,
            psd: exceptions.get('psd') ?? '',
            jpg: exceptions.get('jpg') ?? '',
            createDate: fileDatesMap.get(tif)?.toISOString ?? ''
          }]), resolve)
        }))
      }
    } finally {
      writeStream.end()
    }
  }
}
