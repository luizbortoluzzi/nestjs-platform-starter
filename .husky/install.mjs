// Runs husky setup from the git root.
// Called via `prepare` in apps/api/package.json when `npm install` is run.
import husky from '../apps/api/node_modules/husky/index.js';
const result = husky();
if (result) process.stderr.write(`husky: ${result}\n`);
