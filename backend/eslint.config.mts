import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // 🔹 JS base rules
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
  },

  // 🔹 TypeScript + NestJS
  ...tseslint.configs.recommended,

  // 🔹 Custom backend config
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node, // ✅ IMPORTANT (NestJS = Node)
      },
    },
    rules: {
      // 🔥 clean code rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'class'],

      // DTO friendly
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
]);
