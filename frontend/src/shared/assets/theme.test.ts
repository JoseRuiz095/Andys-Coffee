// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { THEME_CSS_VARIABLES, themePalettes, type ThemeMode } from './theme'

// Vitest does not load CSS files, so the stylesheet is read from disk.
const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf-8')

function cssBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/(--color-[a-z-]+):\s*([^;!]+?)\s*(?:!important)?;/g)].map((m) => [m[1], m[2].toLowerCase()]))
}

const blocks: Record<ThemeMode, Record<string, string>> = {
  light: cssBlock("html[data-theme='light']"),
  dark: cssBlock("html[data-theme='dark']"),
}

describe('theme palettes', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`index.css and themePalettes.${mode} define the same colors`, () => {
      for (const [variable, key] of Object.entries(THEME_CSS_VARIABLES)) {
        expect(blocks[mode][variable], variable).toBe(themePalettes[mode][key].toLowerCase())
      }
    })
  }
})
