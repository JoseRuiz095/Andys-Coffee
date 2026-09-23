import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules', 'dist', 'test-results', 'playwright-report', 'prisma/migrations']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Logging goes through Pino (utils/logger.ts); see CLAUDE.md.
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Test doubles (fake req/res objects, loose JSON payloads) legitimately need `any`.
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Seed and one-off scripts print progress to the terminal on purpose.
    files: ['prisma/seed.ts', 'scripts/**/*.ts', 'dev.js'],
    rules: { 'no-console': 'off' },
  },
])
