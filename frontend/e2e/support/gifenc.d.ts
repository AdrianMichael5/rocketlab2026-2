// gifenc não publica tipos; só o que o GifRecorder usa.
declare module 'gifenc' {
  type Palette = number[][]

  interface WriteFrameOptions {
    palette?: Palette
    delay?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
  }

  interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void
    finish(): void
    bytes(): Uint8Array
  }

  const gifenc: {
    GIFEncoder(): Encoder
    quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette
    nearestColorIndex(palette: Palette, color: number[]): number
  }
  export default gifenc
}
