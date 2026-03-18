// ESLint v9 flat config — replaces .eslintrc.* from previous ESLint versions.
// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  // ─── Global ignores ──────────────────────────────────────────────────────
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },

  // ─── TypeScript source and tests ─────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      // No `project` option here — avoids slow type-aware linting in CI.
      // Add parserOptions: { project: './tsconfig.json' } when you need
      // type-aware rules (e.g. @typescript-eslint/no-floating-promises).
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // ── Error-level: catches real bugs ──────────────────────────────────
      // Unused variables are almost always a mistake. Prefix with _ to opt out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ── Warn-level: advisory style guidance ─────────────────────────────
      // `any` weakens type safety but is sometimes necessary (e.g. ioredis
      // callbacks). Warn rather than error to avoid blocking iterative work.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Empty catch blocks and lifecycle stubs are common in NestJS; warn only.
      '@typescript-eslint/no-empty-function': 'warn',
    },
  },
];
