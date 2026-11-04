import { basename } from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from '../../vitest.config.packages.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      name: basename(import.meta.dirname),

      setupFiles: ['./tests/setup.ts'],

      coverage: {
        thresholds: {
          branches: 86.42,
          functions: 89.92,
          lines: 91.69,
          statements: 91.59,
        },
      },
    },
  }),
);
