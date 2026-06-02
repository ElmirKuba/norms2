// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const jsdoc = require('eslint-plugin-jsdoc');

// Строгость согласована с nest/ (вдохновлено ~/coding/norms). JSDoc и комментарии — на русском.
// Стейт-менеджеры (NgRx и пр.) НЕ используем — Signals + поля класса + rxjs (ADR-0030);
// это архитектурное правило, не линт.
module.exports = defineConfig([
  // ─── TypeScript (строгий типизированный режим) ──
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    plugins: { jsdoc },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],

      // ── Базовые ──
      // Компонент/директива с декоратором — не «лишний» класс, даже если тело пусто.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-unused-vars': 'off',

      // ── Явные типы ──
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: false,
        allowTypedFunctionExpressions: false,
        allowHigherOrderFunctions: false,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ── Промисы / nullability ──
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',

      // ── JSDoc на классах/методах/функциях (на русском) ──
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: false,
        require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
        checkConstructors: false,
      }],
      'jsdoc/require-description': ['error', { checkConstructors: false }],
      'jsdoc/check-alignment': 'error',
      'jsdoc/tag-lines': ['error', 'never'],
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },

  // ─── Точка входа (composition root) ──
  // main.ts — единственное место, где допустим прямой console (лог ошибки bootstrap).
  {
    files: ['src/main.ts'],
    rules: { 'no-console': 'off' },
  },

  // ─── HTML-шаблоны ──
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
