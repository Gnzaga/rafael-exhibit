import sharp from 'sharp'
import { readdir, mkdir } from 'fs/promises'
import { join, parse } from 'path'

const INPUT_DIR = 'paintings'
const OUTPUT_DIR = 'public/images'

const sizes = [
  { name: 'thumb', width: 400, quality: 75 },
  { name: 'medium', width: 1200, quality: 80 },
  { name: 'full', width: 2000, quality: 85 },
]

// Images needing 90-degree clockwise rotation
const rotateMap = new Set([
  'IMG_1253',
  'IMG_1255',
  'IMG_1260',
  'IMG_1261',
  'IMG_1264',
  'IMG_1266',
  'IMG_1273',
])

// How much to crop from each edge (0.12 = 12%)
const CROP_PERCENT = 0.12

async function optimize() {
  // Ensure output dirs exist
  for (const size of sizes) {
    await mkdir(join(OUTPUT_DIR, size.name), { recursive: true })
  }

  const files = (await readdir(INPUT_DIR)).filter((f) =>
    /\.(jpe?g|png)$/i.test(f)
  )

  console.log(`Processing ${files.length} images...\n`)

  for (const file of files) {
    const { name } = parse(file)
    const inputPath = join(INPUT_DIR, file)
    const needsRotation = rotateMap.has(name)

    // First pass: rotate and get dimensions for cropping
    let pre = sharp(inputPath).rotate() // auto-rotate from EXIF
    if (needsRotation) {
      pre = pre.rotate(90)
    }

    const { width, height } = await pre.clone().metadata()
    // After rotation, metadata may not reflect rotated dims — render to buffer to get actual size
    const rotatedMeta = await pre.clone().toBuffer({ resolveWithObject: true })
    const w = rotatedMeta.info.width
    const h = rotatedMeta.info.height

    // Crop 12% from each edge to zoom into the painting
    const cropLeft = Math.round(w * CROP_PERCENT)
    const cropTop = Math.round(h * CROP_PERCENT)
    const cropWidth = w - cropLeft * 2
    const cropHeight = h - cropTop * 2

    const pipeline = sharp(rotatedMeta.data).extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })

    for (const size of sizes) {
      const webpOut = join(OUTPUT_DIR, size.name, `${name}.webp`)
      const jpegOut = join(OUTPUT_DIR, size.name, `${name}.jpg`)

      // WebP
      await pipeline
        .clone()
        .resize(size.width, null, { withoutEnlargement: true })
        .webp({ quality: size.quality })
        .toFile(webpOut)

      // JPEG fallback
      await pipeline
        .clone()
        .resize(size.width, null, { withoutEnlargement: true })
        .jpeg({ quality: size.quality, mozjpeg: true })
        .toFile(jpegOut)
    }

    console.log(`  ✓ ${name}${needsRotation ? ' (rotated 90°)' : ''} — cropped ${cropWidth}x${cropHeight} from ${w}x${h}`)
  }

  console.log(`\nDone! Output in ${OUTPUT_DIR}/`)
}

optimize().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
