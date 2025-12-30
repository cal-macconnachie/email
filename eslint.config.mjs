/**
 * eslint.config.mjs
 *
 * ESLint configuration file.
 */

import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/node_modules/**', '**/.terraform/**', '**/terraform.tfstate*'],
  },

  // Base configs for all files
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  // Type-checked rules only for TypeScript files in lambdas
  {
    files: ['src/lambdas/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: './tsconfig.lambda.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type-checked rules
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // General rules for all files
  {
    name: 'app/rules',
    rules: {
      // Disable semicolons
      'semi': ['error', 'never'],

      // Best practices
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off', // Lambda functions need console.log
      'prefer-const': 'error',
      'no-var': 'error',
      'quotes': ['error', 'single']
    },
  },
)
