import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: ['.next/**', '.next-dev/**', 'node_modules/**', 'public/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Se ejecuta tal cual dentro de las presentaciones: JavaScript llano.
    files: ['src/lib/slide-bridge.runtime.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-var': 'off',
      'prefer-rest-params': 'off',
    },
  },
];

export default config;
