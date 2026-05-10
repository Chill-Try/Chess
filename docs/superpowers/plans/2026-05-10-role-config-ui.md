# Role Config UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old game-mode control with a role-based configuration UI for my side and opponent side.

**Architecture:** Keep the current board behavior intact for now, but move the sidebar controls to a role-driven presentation model. Each side gets an independent role selector and an independent configuration area that expands based on the selected role.

**Tech Stack:** React 19, Vite, plain CSS

---

### Task 1: Add Role And Config State

**Files:**
- Modify: `D:\Code_Space\Chess\src\App.jsx`

- [ ] **Step 1: Add per-side role state**
- [ ] **Step 2: Add per-side computer difficulty and AI form state**
- [ ] **Step 3: Pass the new UI props into the controls and info components**

### Task 2: Rebuild The Control Card

**Files:**
- Modify: `D:\Code_Space\Chess\src\components\GameControls.jsx`

- [ ] **Step 1: Replace game-mode UI with my-side and opponent-side role selectors**
- [ ] **Step 2: Render difficulty options when a side selects computer**
- [ ] **Step 3: Render URL / API key / model name inputs when a side selects AI model**

### Task 3: Update Supporting UI

**Files:**
- Modify: `D:\Code_Space\Chess\src\components\GameInfo.jsx`
- Modify: `D:\Code_Space\Chess\src\App.css`

- [ ] **Step 1: Update labels to match role-based wording**
- [ ] **Step 2: Add layout and form styles for the new config sections**

### Task 4: Verify The New UI

**Files:**
- Verify: `D:\Code_Space\Chess\src\App.jsx`
- Verify: `D:\Code_Space\Chess\src\components\GameControls.jsx`
- Verify: `D:\Code_Space\Chess\src\components\GameInfo.jsx`
- Verify: `D:\Code_Space\Chess\src\App.css`

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: existing project lint failures may remain, but no new errors should point to the new role-config UI files.

- [ ] **Step 2: Refresh the local app and inspect the sidebar**

Open: `http://localhost:5173/`
Expected: the sidebar shows role selectors for both sides and conditional config panels.
