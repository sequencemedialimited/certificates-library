import {
  join,
  basename
} from 'node:path'

import { constants } from 'node:fs'

import {
  glob,
  mkdir,
  copyFile,
  rm,
  cp
} from 'node:fs/promises'

import {
  getFileDate,
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
  const filePathSet = new Set()

  /**
   *  @type {Map<string, Date | null>}
   */
  const fileDateMap = new Map()

  for await (const filePath of glob(join(ORIGIN, '**/*.{tiff,tif}'))) {
    filePathSet.add(filePath)

    const [
      fileDate
    ] = await Promise.all([
      getFileDate(filePath),
      accessFile(toPsdPath(filePath)),
      accessFile(toJpgPath(toPsdPath(filePath)))
    ])

    fileDateMap.set(filePath, fileDate)
  }

  if (filePathSet.size) {
    const fileNameGroups = getFileNameGroups(filePathSet, fileDateMap, LIMIT)

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
