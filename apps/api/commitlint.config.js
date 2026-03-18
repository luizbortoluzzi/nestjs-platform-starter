/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow longer subject lines — 100 chars matches our prettier printWidth.
    'header-max-length': [2, 'always', 100],
  },
};
