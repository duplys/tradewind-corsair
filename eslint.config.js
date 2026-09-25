// SPDX-License-Identifier: GPL-3.0-only
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const presentationLayers = ['render', 'ui', 'input', 'persist'];

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    // src/sim is pure: it must not reach into presentation or browser-facing layers.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: presentationLayers.flatMap((dir) => [`**/${dir}`, `**/${dir}/**`]),
              message: 'src/sim must stay pure: no imports from render/, ui/, input/ or persist/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Headless tools import only the simulation and its data (CLAUDE.md, scripts/).
    files: ['scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['render', 'ui', 'input', 'persist', 'game'].flatMap((dir) => [
                `**/${dir}`,
                `**/${dir}/**`,
              ]),
              message: 'scripts/ may import only src/sim and src/data.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
