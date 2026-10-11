import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'tests/golden/svg/', 'tests/golden/engine/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['scripts/**', 'tests/**', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
