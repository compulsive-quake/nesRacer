import type { GameInfo } from '../types'
import { getRomId } from '../romRegistry'

const artworkGlob = import.meta.glob<string>(
  '/src/assets/artwork/nes/Box_3D/*.png',
  { eager: false, query: '?url', import: 'default' }
)

const thumbGlob = import.meta.glob<string>(
  '/src/assets/artwork/nes/Box_3D_thumb/*.png',
  { eager: false, query: '?url', import: 'default' }
)

function parseTitle(filename: string): string {
  return filename
    .replace(/\.png$/, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
}

const catalog: GameInfo[] = Object.keys(artworkGlob)
  .filter(path => path.endsWith('.png'))
  .map(path => {
    const filename = path.split('/').pop()!
    const title = parseTitle(filename)
    const nesFilename = filename.replace(/\.png$/, '.nes')
    return { filename, title, index: 0, romId: getRomId(nesFilename) }
  })
  .sort((a, b) => a.title.localeCompare(b.title))
  .map((item, i) => ({ ...item, index: i }))

const urlCache = new Map<number, string>()
const thumbCache = new Map<number, string>()

async function resolveImageUrl(index: number): Promise<string> {
  if (urlCache.has(index)) return urlCache.get(index)!
  const game = catalog[index]
  if (!game) return ''
  const globKey = `/src/assets/artwork/nes/Box_3D/${game.filename}`
  const loader = artworkGlob[globKey]
  if (!loader) return ''
  const url = await loader()
  urlCache.set(index, url)
  return url
}

async function resolveThumbUrl(index: number): Promise<string> {
  if (thumbCache.has(index)) return thumbCache.get(index)!
  const game = catalog[index]
  if (!game) return ''
  const globKey = `/src/assets/artwork/nes/Box_3D_thumb/${game.filename}`
  const loader = thumbGlob[globKey]
  if (!loader) return resolveImageUrl(index)
  const url = await loader()
  thumbCache.set(index, url)
  return url
}

let preloadPromise: Promise<void> | null = null
let preloadProgress = 0

async function preloadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  if (preloadPromise) return preloadPromise
  const total = catalog.length
  let loaded = 0
  preloadPromise = Promise.all(
    catalog.map(async (game) => {
      await resolveImageUrl(game.index)
      loaded++
      preloadProgress = loaded
      onProgress?.(loaded, total)
    })
  ).then(() => {})
  return preloadPromise
}

function findGameIndex(partial: string): number {
  const lower = partial.toLowerCase()
  const idx = catalog.findIndex(g => g.filename.toLowerCase().includes(lower))
  return idx >= 0 ? idx : 0
}

export function useGameCatalog() {
  return {
    catalog,
    totalGames: catalog.length,
    resolveImageUrl,
    resolveThumbUrl,
    preloadAll,
    preloadProgress: () => preloadProgress,
    findGameIndex,
  }
}
