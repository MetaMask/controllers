import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCoverageMap } = require('@vitest/istanbul-lib-coverage');

const path = '.vitest/coverage-final.json';
const start = performance.now();

const map = createCoverageMap({});
for (let i = 0; i < 20; i++) {
  map.merge(JSON.parse(readFileSync(path, 'utf8')));
}

const summary = map.getCoverageSummary();
console.log('merge of 20 copies (ms):', Math.round(performance.now() - start));
console.log('files:', map.files().length, 'statements:', summary.statements.total);
