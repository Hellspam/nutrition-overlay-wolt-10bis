import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.entry.ts', 'vrun.mjs', 'shot.mjs', 'render-icons.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Extension source runs in the browser / content-script + service-worker context.
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  // Tests (jsdom) and Node tooling get both browser and node globals.
  {
    files: ['tests/**/*.ts', 'build.mjs', '**/*.config.{js,ts,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    rules: {
      // Nutrition parsing and a few DOM-state flags use `any` intentionally — warn, don't block.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow deliberately-unused args/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
