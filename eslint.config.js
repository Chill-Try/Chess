/**
 * @file eslint.config.js
 * @description ESLint 代码规范检查配置
 *
 * 规则：
 * - 继承 ESLint、React Hooks、React Refresh 推荐配置
 * - 支持现代 JavaScript 和 JSX 语法
 * - 忽略未使用变量的错误（仅大写和下划线开头的变量）
 *
 * @requires @eslint/js - ESLint 核心
 * @requires globals - 全局变量定义
 * @requires eslint-plugin-react-hooks - React Hooks 规则
 * @requires eslint-plugin-react-refresh - React Fast Refresh 规则
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  /** 忽略构建输出目录 */
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
