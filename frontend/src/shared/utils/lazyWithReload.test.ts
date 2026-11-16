import { describe, expect, it } from 'vitest'
import { isChunkLoadError, shouldReloadForChunkError } from './lazyWithReload'

const chunkError = new TypeError('Failed to fetch dynamically imported module: https://app/assets/InventoryLayout-abc.js')

describe('isChunkLoadError', () => {
  it('recognises missing chunks in every browser', () => {
    expect(isChunkLoadError(chunkError)).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})

describe('shouldReloadForChunkError', () => {
  it('reloads once, then lets the error surface instead of looping', () => {
    expect(shouldReloadForChunkError(chunkError, 1_000)).toBe(true)
    expect(shouldReloadForChunkError(chunkError, 5_000)).toBe(false)
  })

  it('reloads again after the guard window (a later deploy)', () => {
    expect(shouldReloadForChunkError(chunkError, 1_000)).toBe(true)
    expect(shouldReloadForChunkError(chunkError, 60_000)).toBe(true)
  })

  it('never reloads for ordinary errors', () => {
    expect(shouldReloadForChunkError(new Error('boom'), 1_000)).toBe(false)
  })
})
