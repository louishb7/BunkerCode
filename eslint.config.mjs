import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/vite.config.ts', '.bunkerlab/**', '.backendlab/**'] },
  { files: ['templates/**/*.mjs'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly' } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
