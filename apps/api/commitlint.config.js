/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer subject lines — 100 chars matches our prettier printWidth.
    'header-max-length': [2, 'always', 100],

    // Restrict scopes to known areas of the codebase so the log stays readable.
    // Add new entries here when you introduce a new module or top-level concern.
    'scope-enum': [
      2,
      'always',
      [
        'api',
        'auth',
        'cache',
        'ci',
        'config',
        'database',
        'deps',
        'docker',
        'health',
        'infra',
        'metrics',
        'projects',
        'queue',
        'users',
      ],
    ],
  },
};
