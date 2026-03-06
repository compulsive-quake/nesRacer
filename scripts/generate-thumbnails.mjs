import sharp from 'sharp'
import { readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCE = 'src/assets/artwork/nes/Box_3D'
const DEST = 'src/assets/artwork/nes/Box_3D_thumb'
const WIDTH = 200

await mkdir(DEST, { recursive: true })

const files = (await readdir(SOURCE)).filter(f => f.toLowerCase().endsWith('.png'))
console.log(`Generating ${files.length} thumbnails (${WIDTH}px wide)...`)

let done = 0
const BATCH = 20

for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH)
  await Promise.all(batch.map(async (file) => {
    const src = join(SOURCE, file)
    const dst = join(DEST, file)
    await sharp(src)
      .resize({ width: WIDTH })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(dst)
    done++
    if (done % 100 === 0) console.log(`  ${done}/${files.length}`)
  }))
}

console.log(`Done. ${done} thumbnails written to ${DEST}`)
