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
    // Controllers → Services → Repositories → Prisma (CLAUDE.md): only repositories talk to
    // the database. Services use repositories and repositories/transaction.ts for transactions.
    files: ['src/services/**/*.ts', 'src/controllers/**/*.ts', 'src/routes/**/*.ts', 'src/middleware/**/*.ts', 'src/jobs/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/config/prisma'], message: 'Usa un repositorio (src/repositories); los servicios no acceden a Prisma directamente.' }],
      }],
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
