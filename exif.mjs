import ExifReader from 'exifreader'
import { glob, stat, readFile } from 'node:fs/promises'

/**
 *  @type {Map<string, Date>}
 */
const fileDatesMap = new Map()

/**
 *  @param {string} filePath
 */
async function getFileDate (filePath) {
  if (!fileDatesMap.has(filePath)) {
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

  return fileDatesMap.get(filePath)
}

async function main () {
  for await (const filePath of glob('/Volumes/Alpha/Storage/Research/Documents/Scratch/Temporary/v4/**/*.{tiff,tif}')) {
    console.log(await getFileDate(filePath))
  }
}

export default main()
