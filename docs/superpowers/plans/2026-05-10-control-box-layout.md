# Control Box Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the color selection and reset actions into a dedicated top box inside the Chess control panel.

**Architecture:** Keep the existing `GameControls` card as the outer container, add a nested top action box for color and reset controls, and style that nested box to read as a separate visual section. No behavior changes are needed; this is a layout-only adjustment.

**Tech Stack:** React 19, Vite, plain CSS

---

### Task 1: Restructure The Controls Markup

**Files:**
- Modify: `D:\Code_Space\Chess\src\components\GameControls.jsx`

- [ ] **Step 1: Add a dedicated top action box wrapper**

Wrap the existing color buttons and reset button in a new container:

```jsx
<div className="top-action-box">
  <h3>开局操作</h3>
  <div className="button-row">
    ...
  </div>
  <button className="primary-button" type="button" onClick={onReset}>
    重新开始
  </button>
</div>
```

- [ ] **Step 2: Keep mode and difficulty controls below the new box**

Leave the existing mode switcher and difficulty section in the outer card so only layout hierarchy changes.

### Task 2: Add Matching Styles

**Files:**
- Modify: `D:\Code_Space\Chess\src\App.css`

- [ ] **Step 1: Add the nested box styles**

Create a visual sub-panel style:

```css
.top-action-box {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(254, 249, 240, 0.45);
  border: 1px solid rgba(139, 105, 20, 0.18);
}
```

- [ ] **Step 2: Add heading spacing rules**

Keep the new section title compact so it aligns with the existing card style.

### Task 3: Verify Layout Safety

**Files:**
- Verify: `D:\Code_Space\Chess\src\components\GameControls.jsx`
- Verify: `D:\Code_Space\Chess\src\App.css`

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: exit code 0

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: exit code 0
