module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

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
    },

    {
      files: ['*.js'],
      parserOptions: {
        sourceType: 'script',
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    // TODO
    // {
    //   files: ['*.test.ts', '*.test.js'],
    //   extends: ['@metamask/eslint-config-jest'],
    // },
  ],

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/'],
};
