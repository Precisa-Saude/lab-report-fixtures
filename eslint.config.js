import base from '@precisa-saude/eslint-config/base';

export default [
  ...base,
  { ignores: ['dist/**', 'coverage/**', '__tests__/**', '*.config.ts'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
