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

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/'],
};
