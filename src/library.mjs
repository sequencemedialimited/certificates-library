import ExifReader from 'exifreader'

import {
  join,
  basename
} from 'node:path'

import { constants } from 'node:fs'

import {
  glob,
  stat,
  mkdir,
  readFile,
  copyFile,
  rm,
  cp
} from 'node:fs/promises'

import {
  toPsdPath,
  toJpgPath,
  getFileNameGroups,
  createDir,
  accessFile
} from './utils/index.mjs'

/**
 *  @param {string} topDir
 *  @param {{
 *    origin: string,
 *    limit: number,
 *    destination: string,
 *  }} params
 */
export default async function library (topDir, {
  origin: ORIGIN,
  limit: LIMIT,
  destination: DESTINATION
}) {
  /**
   *  @type {Set<string>}
   */
  const filePathsSet = new Set()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) filePathsSet.add(filePath)

  if (filePathsSet.size) {
    /**
     *  @type {Map<string, Date>}
     */
    const fileDatesMap = new Map()

    for (const filePath of filePathsSet) {
      const psd = toPsdPath(filePath)
      const jpg = toJpgPath(toPsdPath(filePath))

      await Promise.all([
        accessFile(psd),
        accessFile(jpg)
      ])

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

    const fileNameGroups = getFileNameGroups(filePathsSet, fileDatesMap, LIMIT)

    const TIF = join(topDir, 'TIF')
    const PSD = join(topDir, 'PSD')

    // siblings
    await Promise.all([
      createDir(TIF),
      createDir(PSD)
    ])

    for (const [i, fileNameGroup] of fileNameGroups.entries()) {
      const subDir = (i + 1).toString(16).toLocaleUpperCase()

      const tifDir = join(TIF, subDir)
      const psdDir = join(PSD, subDir)

      // siblings
      await Promise.all([
        createDir(tifDir),
        createDir(psdDir)
      ])

      const jpgDir = join(PSD, subDir, 'JPG')

      // child
      await createDir(jpgDir)

      for (const filePath of fileNameGroup) {
        const tif = join(tifDir, basename(filePath))
        const psd = toPsdPath(tif)
        const jpg = toJpgPath(toPsdPath(tif))

        await Promise.all([
          copyFile(filePath, tif, constants.COPYFILE_EXCL),
          copyFile(toPsdPath(filePath), psd, constants.COPYFILE_EXCL),
          copyFile(toJpgPath(toPsdPath(filePath)), jpg, constants.COPYFILE_EXCL)
        ])
      }
    }

    await rm(DESTINATION, { recursive: true })
    await mkdir(DESTINATION)
    await cp(topDir, DESTINATION, { recursive: true })
  }
}
