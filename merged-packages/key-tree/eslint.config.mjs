import base, { createConfig } from '@metamask/eslint-config';
import jest from '@metamask/eslint-config-jest';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';

const config = createConfig([
  {
    ignores: ['dist/', 'docs/', '.yarn/'],
  },

  {
    extends: base,

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
    },
  },

  {
    files: ['**/*.ts'],
    extends: typescript,

    rules: {
      camelcase: [
        'error',
        {
          properties: 'never',
          allow: ['^UNSAFE_', 'coin_type', 'address_index'],
        },
      ],

      // This rule is copied from the base config, but changed to allow for
      // `snake_case` properties. This is because we use those a lot in this
      // repository, and replacing them would be a breaking change.
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase', 'snake_case'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        {
          selector: 'objectLiteralMethod',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'objectLiteralProperty',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
      ],
    },
  },

  {
    files: ['**/*.js', '**/*.cjs'],
    extends: nodejs,

    languageOptions: {
      sourceType: 'script',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.js'],
    extends: [jest, nodejs],

    rules: {
      'jest/no-conditional-in-test': 'off',
    },
  },
]);

export default config;
