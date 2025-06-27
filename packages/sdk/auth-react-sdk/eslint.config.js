import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Files to lint
  { files: ['src/**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  
  // Language options
  { 
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node
      }
    } 
  },
  
  // Base configs
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  
  // React config
  {
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+
      'react/prop-types': 'error', // Using TypeScript
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  
  // Prettier (must be last)
  eslintConfigPrettier,
];