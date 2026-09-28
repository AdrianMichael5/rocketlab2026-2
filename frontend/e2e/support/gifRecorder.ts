import { writeFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'

const { GIFEncoder, nearestColorIndex, quantize } = gifenc

/** 255 cores na paleta + 1 índice reservado para "pixel igual ao frame anterior". */
const MAX_COLORS = 255
/** "Não descartar": o frame seguinte desenha por cima do anterior. */
const DISPOSE_KEEP = 1
const LAST_FRAME_HOLD_MS = 2_500
const PALETTE_SAMPLE_FRAMES = 12

interface Frame {
  png: Buffer
  at: number
}

interface DecodedFrame {
  rgba: Uint8Array
  width: number
  height: number
  delay: number
}

/**
 * Grava a página como GIF: captura screenshots em intervalo fixo enquanto o teste
 * interage e, no fim, codifica só os pixels que mudaram entre um frame e outro
 * (o resto vira transparente), o que mantém o arquivo pequeno.
 */
export class GifRecorder {
  private readonly page: Page
  private readonly intervalMs: number
  private readonly frames: Frame[] = []
  private loop: Promise<void> | null = null
  private recording = false

  constructor(page: Page, { fps = 8 } = {}) {
    this.page = page
    this.intervalMs = Math.round(1000 / fps)
  }

  start(): void {
    this.recording = true
    this.loop = this.captureLoop()
  }

  async stop(): Promise<void> {
    this.recording = false
    await this.loop
  }

  /** Codifica e grava o GIF; devolve quantos frames distintos entraram. */
  save(path: string): number {
    const frames = this.distinctFrames()
    // Paleta única: com uma por frame, o mesmo fundo sairia em tons diferentes conforme
    // o frame em que foi redesenhado, deixando "fantasmas" nas áreas transparentes.
    const palette = quantize(sampleFrames(frames), MAX_COLORS)
    const transparentIndex = palette.length
    const gifPalette = [...palette, [0, 0, 0]]
    const toIndex = paletteIndexer(palette)
    const gif = GIFEncoder()
    let previous: Uint8Array | null = null
    for (const [index, { rgba, width, height, delay }] of frames.entries()) {
      const indexed = toIndex(rgba)
      if (previous) markUnchanged(indexed, rgba, previous, transparentIndex)
      gif.writeFrame(indexed, width, height, {
        palette: gifPalette,
        delay: index === frames.length - 1 ? LAST_FRAME_HOLD_MS : delay,
        transparent: previous !== null,
        transparentIndex,
        dispose: DISPOSE_KEEP,
      })
      previous = rgba
    }
    gif.finish()
    writeFileSync(path, gif.bytes())
    return frames.length
  }

  private async captureLoop(): Promise<void> {
    while (this.recording) {
      const at = Date.now()
      const png = await this.page.screenshot({ animations: 'disabled', caret: 'hide' })
      this.frames.push({ png, at })
      const wait = this.intervalMs - (Date.now() - at)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }

  /** Junta frames idênticos seguidos num só, somando o tempo em tela. */
  private distinctFrames(): DecodedFrame[] {
    const distinct: { png: Buffer; at: number; until: number }[] = []
    for (const [index, frame] of this.frames.entries()) {
      const until = this.frames[index + 1]?.at ?? frame.at + this.intervalMs
      const last = distinct.at(-1)
      if (last?.png.equals(frame.png)) last.until = until
      else distinct.push({ ...frame, until })
    }
    return distinct.map(({ png, at, until }) => {
      const { data, width, height } = PNG.sync.read(png)
      return { rgba: new Uint8Array(data), width, height, delay: until - at }
    })
  }
}

/**
 * Converte pixels em índices da paleta com um cache pela cor exata, compartilhado entre
 * os frames. O applyPalette do gifenc agrupa cores parecidas (RGB565) e pode dar
 * índices diferentes à mesma cor em frames diferentes, o que quebra a transparência.
 */
function paletteIndexer(palette: number[][]): (rgba: Uint8Array) => Uint8Array {
  const cache = new Map<number, number>()
  return (rgba) => {
    const indexed = new Uint8Array(rgba.length / 4)
    for (let pixel = 0; pixel < indexed.length; pixel++) {
      const offset = pixel * 4
      const red = rgba[offset]
      const green = rgba[offset + 1]
      const blue = rgba[offset + 2]
      const key = (red << 16) | (green << 8) | blue
      let index = cache.get(key)
      if (index === undefined) {
        index = nearestColorIndex(palette, [red, green, blue])
        cache.set(key, index)
      }
      indexed[pixel] = index
    }
    return indexed
  }
}

/** Junta alguns frames espaçados para calcular a paleta (todos pesaria demais). */
function sampleFrames(frames: DecodedFrame[]): Uint8Array {
  const step = Math.max(1, Math.floor(frames.length / PALETTE_SAMPLE_FRAMES))
  const sampled = frames.filter((_, index) => index % step === 0)
  const joined = new Uint8Array(sampled.reduce((size, frame) => size + frame.rgba.length, 0))
  let offset = 0
  for (const { rgba } of sampled) {
    joined.set(rgba, offset)
    offset += rgba.length
  }
  return joined
}

/** Pixels iguais ao frame anterior apontam para o índice transparente. */
function markUnchanged(
  indexed: Uint8Array,
  rgba: Uint8Array,
  previous: Uint8Array,
  transparentIndex: number,
): void {
  for (let pixel = 0; pixel < indexed.length; pixel++) {
    const offset = pixel * 4
    if (
      rgba[offset] === previous[offset] &&
      rgba[offset + 1] === previous[offset + 1] &&
      rgba[offset + 2] === previous[offset + 2]
    ) {
      indexed[pixel] = transparentIndex
    }
  }
}
