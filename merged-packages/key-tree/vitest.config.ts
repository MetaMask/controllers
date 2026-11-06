import { basename } from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from '../../vitest.config.packages.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: basename(import.meta.dirname),

      // The tests in `test/` are not covered by the shared `include` pattern,
      // which only matches `tests/`.
      include: ['test/**/*.test.ts'],

      // Several tests derive many keys, so a test that takes this long is
      // most likely stuck.
      testTimeout: 2500,

      coverage: {
        thresholds: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  }),
);
