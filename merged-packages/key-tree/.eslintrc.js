module.exports = {
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/nodejs',
  ],
  plugins: [
    'json',
  ],
  parserOptions: {
    ecmaVersion: 2018,
  },
  overrides: [
    {
      files: [
        '**/*.ts',
      ],
      extends: [
        '@metamask/eslint-config/config/typescript',
      ],
    },
    {
      files: [
        '**/*.d.ts',
      ],
      rules: {
        'import/unambiguous': 'off',
      },
    },
  ],
  ignorePatterns: [
    '!.eslintrc.js',
    'dist/',
    'node_modules/',
  ],
};
