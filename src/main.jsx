/**
 * @file main.jsx
 * @description 应用入口文件
 *
 * 这是整个 React 应用的入口点，负责：
 * 1. 引入全局样式 (index.css)
 * 2. 创建 React 根节点并挂载到 DOM
 * 3. 使用 StrictMode 启用 React 严格模式（仅在开发环境进行额外检查）
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * 创建 React 应用根节点并渲染 App 组件
 *
 * createRoot: React 18 引入的新 API，允许创建多个独立的根节点
 * document.getElementById('root'): 对应 index.html 中的 <div id="root"></div>
 *
 * StrictMode: 启用 React 严格模式，会在开发环境进行以下额外检查：
 * - 检测组件的副作用（useEffect）是否遵循规则
 * - 检测不推荐的 API 使用
 * - 双重调用组件渲染以检测副作用问题
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)