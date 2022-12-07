module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

  rules: {
    camelcase: [
      'error',
      {
        properties: 'never',
        allow: ['^UNSAFE_', 'coin_type', 'address_index'],
      },
    ],
  },

  overrides: [
    {
      files: ['*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
      },
    },

    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

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
      files: ['*.js'],
      parserOptions: {
        sourceType: 'script',
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['*.test.ts', '*.test.js'],
      extends: ['@metamask/eslint-config-jest'],
    },

    // Allow expect(value).toMatchSnapshot in this file only
    {
      files: ['./test/reference-implementations.test.ts'],
      rules: {
        'jest/no-restricted-matchers': [
          'error',
          {
            resolves: 'Use `expect(await promise)` instead.',
            toBeFalsy: 'Avoid `toBeFalsy`',
            toBeTruthy: 'Avoid `toBeTruthy`',
            // toMatchSnapshot: ...
            toThrowErrorMatchingSnapshot:
              'Use `toThrowErrorMatchingInlineSnapshot()` instead',
          },
        ],
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/', 'docs/'],
};
