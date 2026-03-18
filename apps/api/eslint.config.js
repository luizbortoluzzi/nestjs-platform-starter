// @ts-check
// ESLint v9 flat config — type-aware, import ordering, unused imports.
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');
const prettierConfig = require('eslint-config-prettier');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  // ─── Global ignores ───────────────────────────────────────────────────────
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },

  // ─── TypeScript source and tests ─────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Type-aware linting — enables the most valuable rule category.
        // Slower than plain parsing but catches real runtime bugs (unhandled
        // promises, misused async callbacks, awaiting non-Promises, etc.).
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // ── Unused symbols ──────────────────────────────────────────────────
      // unused-imports handles both imports and variables in one pass.
      // Prefix names with _ to opt out of the check.
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': 'off', // delegated to unused-imports
      'unused-imports/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ── Type-aware rules (require parserOptions.project) ────────────────
      // Highest-value category — catches real runtime crashes at lint time.

      // Unhandled promise rejections are silent runtime bombs.
      '@typescript-eslint/no-floating-promises': 'error',

      // async function passed where sync callback expected (e.g. forEach).
      // attributes: false — allows async NestJS lifecycle hooks in decorators.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      // Prevents `await` on non-Promise values.
      '@typescript-eslint/await-thenable': 'error',

      // Flags async functions that never await anything.
      '@typescript-eslint/require-await': 'error',

      // ── Explicit any ────────────────────────────────────────────────────
      // no-explicit-any: warn only — NestJS/Express boundaries are legitimately any.
      // no-unsafe-assignment / no-unsafe-return are deliberately omitted:
      // framework glue (ExecutionContext, req, res) is typed as any at the
      // Express layer and suppressing it per-line would be more noise than value.
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── Empty functions ─────────────────────────────────────────────────
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['constructors', 'arrowFunctions'] },
      ],

      // ── Import ordering ─────────────────────────────────────────────────
      // Groups: Node built-ins → third-party → internal paths.
      // Blank line required between groups; alphabetical within each group.
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            // Keep @nestjs/* grouped with other externals at the top.
            { pattern: '@nestjs/**', group: 'external', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // ─── Prettier — must be last so it overrides conflicting style rules ──────
  prettierConfig,
];
