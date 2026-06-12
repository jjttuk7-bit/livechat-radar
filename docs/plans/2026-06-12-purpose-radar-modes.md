# Purpose Radar Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add purpose-specific radar modes so LiveChat Radar can guide hosts differently for commerce, education, fandom, and issue livestreams.

**Architecture:** Keep the first version frontend-first and mock-driven. Mode definitions live in config, rule-based analysis lives in pure library functions, and React components consume typed results without changing the existing `/api/analyze` OpenAI schema.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide-React, `tsx` test runner.

---

### Task 1: Type And Config Boundary

**Files:**
- Create: `src/types/liveRadar.ts`
- Create: `src/config/liveModes.ts`

**Steps:**
1. Define `LiveModeId`, `LiveModeConfig`, `AlertRule`, `CommentAnalysis`, `RadarMetric`, `ActionCard`, and `PostLiveReport`.
2. Add four mode configs: commerce, education, fandom, issue.
3. Keep issue mode safety guidelines explicit and neutral.

### Task 2: Test-First Analysis Logic

**Files:**
- Modify: `package.json`
- Create: `src/lib/liveRadar.test.ts`
- Create: `src/lib/analyzeComments.ts`
- Create: `src/lib/generateActionCards.ts`

**Steps:**
1. Add `npm test` using `tsx src/lib/liveRadar.test.ts`.
2. Write failing tests for category classification, action card generation, and mode-specific report sections.
3. Run `npm test` and confirm missing modules fail.
4. Implement keyword-based `analyzeComments`, `generateActionCards`, mock comments, metrics, distribution, and post-live report preview.
5. Run `npm test` and confirm pass.

### Task 3: Purpose Radar UI

**Files:**
- Create: `src/components/ModeSelector.tsx`
- Create: `src/components/ModeDashboard.tsx`
- Create: `src/components/RadarMetrics.tsx`
- Create: `src/components/ActionCards.tsx`
- Create: `src/components/IssueTimeline.tsx`
- Create: `src/components/PostLiveReport.tsx`
- Modify: `src/App.tsx`

**Steps:**
1. Build card-style mode selection with clear selected state.
2. Build dashboard header, mode-specific metrics, three action cards, category distribution, and report preview.
3. Integrate `selectedLiveMode` state into `App.tsx`.
4. Reuse existing copy-to-clipboard behavior for presenter suggested lines.

### Task 4: Verification

**Commands:**
- `npm test`
- `npm run lint`
- `npm run build`

**Checks:**
1. Tests pass for rule-based analysis.
2. TypeScript compiles with `tsc --noEmit`.
3. Production build succeeds.
4. Browser smoke test confirms mode cards, action cards, report preview, and issue safety copy render.
