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
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
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
      extends: [
        '@metamask/eslint-config-jest',
        '@metamask/eslint-config-nodejs',
      ],
    },
  ],

  ignorePatterns: [
    '!.eslintrc.js',
    '!.prettierrc.js',
    'dist/',
    'docs/',
    '.yarn/',
  ],
};
