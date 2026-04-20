/**
 * @file vite.config.js
 * @description Vite 构建工具配置文件
 *
 * 配置 React 插件以支持 JSX 语法
 *
 * @requires vite - 构建工具
 * @requires @vitejs/plugin-react - React 插件
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** @type {import('vite').UserConfig} */
export default defineConfig({
  plugins: [react()],
})
