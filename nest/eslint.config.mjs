// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

// Строгость вдохновлена ~/coding/norms (переосмыслено под наш стек: 5-слойка, Drizzle, Nest 11).
// JSDoc и комментарии в коде — на русском (правило Elmir).
export default tseslint.config(
  // ─── Исключения ───────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.spec.ts', 'eslint.config.mjs', 'drizzle.config.ts'],
  },

  // ─── TypeScript (строгий типизированный режим) ──────────────────────────────
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { jsdoc },
    rules: {
      // ── Базовые JS ──
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-unused-vars': 'off',

      // ── Явные типы везде ──
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: false,
        allowTypedFunctionExpressions: false,
        allowHigherOrderFunctions: false,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/typedef': ['error', {
        arrowParameter: true,
        memberVariableDeclaration: true,
        parameter: true,
        propertyDeclaration: true,
        variableDeclaration: false,
      }],
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ── Именование ──
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        { selector: 'memberLike', modifiers: ['public'], format: ['camelCase'], leadingUnderscore: 'forbid' },
        { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'require' },
        { selector: 'memberLike', modifiers: ['protected'], format: ['camelCase'], leadingUnderscore: 'require' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'function', format: ['camelCase'] },
        { selector: 'typeProperty', format: ['camelCase', 'snake_case'] },
        { selector: 'objectLiteralProperty', format: ['camelCase', 'snake_case', 'UPPER_CASE'] },
      ],

      // ── Порядок членов класса ──
      '@typescript-eslint/member-ordering': ['error', {
        default: [
          'static-field', 'static-method',
          'public-field', 'protected-field', 'private-field',
          'constructor',
          'public-method', 'protected-method', 'private-method',
        ],
      }],

      // ── Readonly / nullability / промисы ──
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/strict-boolean-expressions': ['error', {
        allowNullableBoolean: true,
        allowNullableString: false,
        allowNullableNumber: false,
        allowNullableObject: false,
        allowAny: false,
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
        disallowTypeAnnotations: true,
      }],
      '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: false }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/promise-function-async': ['error', { checkMethodDeclarations: false }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': ['error', {
        allowDefaultCaseForExhaustiveSwitch: false,
        requireDefaultForNonUnion: true,
      }],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',

      // ── JSDoc обязателен на классах/функциях/методах/типах (на русском) ──
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: false,
        require: {
          ClassDeclaration: true,
          FunctionDeclaration: true,
          MethodDefinition: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
        contexts: [
          'TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration',
          'TSEnumMember', 'TSPropertySignature', 'PropertyDefinition',
        ],
        checkConstructors: false,
      }],
      'jsdoc/require-description': ['error', { checkConstructors: false }],
      'jsdoc/require-param': ['error', { checkDestructured: false, checkConstructors: false }],
      'jsdoc/require-param-name': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': ['error', { checkConstructors: false, checkGetters: false }],
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-throws': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-alignment': 'error',
      'jsdoc/tag-lines': ['error', 'never'],
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },

  // ─── DTO: публичные поля могут быть snake_case (JSON-ключи api-contracts) ────
  {
    files: ['src/**/*.dto.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        { selector: 'memberLike', modifiers: ['public'], format: ['camelCase', 'snake_case'], leadingUnderscore: 'forbid' },
        { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'require' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'function', format: ['camelCase'] },
      ],
    },
  },

  // ─── Drizzle-схемы: сложные внутренние типы pgTable ──────────────────────────
  {
    files: ['src/database/schemas/*.ts'],
    rules: {
      '@typescript-eslint/typedef': ['error', {
        arrowParameter: false,
        memberVariableDeclaration: true,
        parameter: true,
        propertyDeclaration: true,
        variableDeclaration: false,
      }],
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      'jsdoc/require-jsdoc': 'off',
    },
  },
);
