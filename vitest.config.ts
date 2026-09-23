import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Enables @testing-library/react auto-cleanup (afterEach) — required for
    // component tests that render multiple times per file.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}', 'server/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Baseline captured 2026-09-21 (see spec-kit-tdd-plan.md). Floor = last ratchet - 1pt:
      // any regression fails CI. Ratchet up after each feature lands.
      // Original baseline (stmts/branch/funcs/lines): 42.45 / 38.53 / 31.44 / 43.97
      // Ratcheted after 001-workbench-toolbar-tools (2026-09-21): 47.53 / 42.88 / 40.54 / 49.19
      thresholds: {
        statements: 46,
        branches: 41,
        functions: 39,
        lines: 48,
      },
      exclude: [
        'node_modules/**',
        'coverage/**',
        'src/**/*.d.ts',
        'src/types/**',
        'drizzle/**',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
})
