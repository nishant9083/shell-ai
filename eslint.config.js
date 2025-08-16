import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginImport from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier/recommended';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';

export default [
  // Flat config doesn't have a 'root' option, it is root by default.
  // The ignorePatterns are now at the top level of the configuration object.
  {
    ignores: [
      'dist/',
      'node_modules/',
      '**/*.js',
      '**/*.d.ts',
      '**/__tests__/**'
    ]
  },
  
  // Use the recommended configurations
  eslint.configs.recommended,
  ...tsEslint.configs.recommended,
  prettier, // Prettier config is now an import

  {
    // These options are now at the top level of their config object
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsEslint.parser,
      parserOptions: {
        // project: ['tsconfig.json', 'packages/cli/tsconfig.test.json'],
        projectService: true, // Enables project service for better performance
        // tsconfigRootDir is helpful for monorepos
        
        tsconfigRootDir: import.meta.dirname,
      },
    },
    
    // Plugins are specified in the `plugins` field of a config object
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      'import': eslintPluginImport,
      'unused-imports': eslintPluginUnusedImports
    },
    
    // The `env` options are replaced by the `globals` option in `languageOptions` for fine-grained control
    // However, for this setup, we will rely on the default environments provided by the parser and plugins.

    // Rules are defined in a `rules` field
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always'
        }
      ],
      'no-console': 'off',
      'no-debugger': 'warn'
    },
  },
];