# Implementation Plan: Personal Dashboard

## Overview

Implement a single-page personal dashboard using vanilla HTML, CSS, and JavaScript. All logic lives in `js/app.js`, all styles in `css/style.css`, and the entry point is `index.html`. State is persisted via `localStorage`.

> **Optional tests:** Tasks marked **[OPTIONAL — requires Node.js + Jest]** use fast-check + Jest + jsdom and need Node.js (v18+) and `npm install` to run. They can be skipped entirely — the app works without them. See task 15 for setup instructions.

---

## Tasks

- [ ] 1. Scaffold project structure and HTML skeleton
  <!-- Status: not started — index.html and css/style.css do not exist yet -->
  - Create `index.html` at the repository root with semantic HTML sections for all six widgets: `#greeting-widget`, `#name-form`, `#timer-widget`, `#timer-config`, `#todo-widget`, `#links-widget`, and `#theme-toggle`
  - Add `<link rel="stylesheet" href="css/style.css">` and `<script src="js/app.js" defer></script>` to `index.html`
  - Create `css/style.css` with CSS custom properties for light and dark themes (`[data-theme="light"]` / `[data-theme="dark"]`) and base layout styles
  - Create `js/app.js` with the top-level `App` namespace object and stub sub-objects: `App.Storage`, `App.Greeting`, `App.NameInput`, `App.Timer`, `App.TimerConfig`, `App.Todo`, `App.Links`, `App.Theme`, and `App.init()`
  - Add ARIA labels to all icon-only controls and `aria-live="polite"` to `#timer-complete-msg` and all `#*-error` elements
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 2. Implement `App.Storage` utility
  <!-- Status: 2.1 complete; 2.2 (tests) not started -->
  - [x] 2.1 Implement `App.Storage.get(key, defaultValue)`, `App.Storage.set(key, value)`, and `App.Storage.remove(key)` in `js/app.js`
    - `get` must parse JSON and return `defaultValue` on any error
    - `set` must serialize to JSON, catch `QuotaExceededError`, and return `{ ok: true }` or `{ ok: false, error }`
    - `remove` must call `localStorage.removeItem(key)`
    - _Requirements: 9.4, 9.5_

  - [ ] 2.2 **[OPTIONAL — requires Node.js + Jest]** Write unit tests for `App.Storage` error handling
    - Test `set` returning `{ ok: false }` when `localStorage.setItem` throws
    - Test `get` returning `defaultValue` when `localStorage.getItem` throws or returns invalid JSON
    - Create `tests/storage.test.js`
    - _Requirements: 9.4, 9.5_

- [ ] 3. Implement `App.Theme` (light/dark toggle)
  - [ ] 3.1 Implement `App.Theme.init()`, `App.Theme.toggle()`, and `App.Theme._apply(theme)` in `js/app.js`
    - `init` reads `pd_theme` from `App.Storage`; falls back to `window.matchMedia('(prefers-color-scheme: dark)')` if no saved value
    - `_apply` sets `document.documentElement.setAttribute('data-theme', theme)` and updates `#theme-toggle` icon/label
    - `toggle` flips `_current`, calls `_apply`, and persists via `App.Storage.set('pd_theme', ...)`
    - Apply theme within 100 ms of toggle activation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 3.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for theme persistence round-trip (Property 24)
    - **Property 24: Theme persistence round-trip**
    - **Validates: Requirements 11.4**
    - Use `fc.constantFrom('light', 'dark')` to generate theme values; assert `localStorage` key `pd_theme` equals the applied value
    - Create `tests/theme.test.js`

- [ ] 4. Implement `App.Greeting` (live clock, date, greeting phrase)
  - [ ] 4.1 Implement `App.Greeting.init()`, `App.Greeting._tick()`, `App.Greeting._renderDate()`, `App.Greeting._renderGreeting()`, and `App.Greeting._getGreetingPhrase(hour)` in `js/app.js`
    - `init` starts a `setInterval` at 1 000 ms and calls `_tick()` immediately
    - `_tick` formats the current time as `HH:MM:SS` (zero-padded) and writes to `#clock`
    - `_renderDate` formats the date as "Weekday, D Month YYYY" and writes to `#date-display`
    - `_getGreetingPhrase` returns "Good Morning" (hours 5–11), "Good Afternoon" (12–17), "Good Evening" (0–4, 18–23)
    - `_renderGreeting` reads `pd_userName` from `App.Storage` and appends the name (truncated to 50 chars) if present
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 4.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for time formatting correctness (Property 1)
    - **Property 1: Time formatting correctness**
    - **Validates: Requirements 1.1, 3.1**
    - Use `fc.integer({min:0,max:23})` and `fc.integer({min:0,max:59})` × 2; assert output matches `/^\d{2}:\d{2}:\d{2}$/` for clock and `/^\d{2}:\d{2}$/` for timer
    - Create `tests/greeting.test.js`

  - [ ] 4.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for greeting phrase coverage (Property 2)
    - **Property 2: Greeting phrase covers all hours**
    - **Validates: Requirements 1.3, 1.4, 1.5**
    - Use `fc.integer({min:0,max:23})`; assert exactly one of the three phrases is returned for every hour
    - Add to `tests/greeting.test.js`

  - [ ] 4.4 **[OPTIONAL — requires Node.js + Jest]** Write property test for greeting name truncation (Property 3)
    - **Property 3: Greeting includes truncated name**
    - **Validates: Requirements 1.6**
    - Use `fc.string({minLength:1,maxLength:200})`; assert rendered greeting contains at most 50 characters of the name
    - Add to `tests/greeting.test.js`

- [ ] 5. Implement `App.NameInput` (custom name form)
  - [ ] 5.1 Implement `App.NameInput.init()` and `App.NameInput._onSubmit(e)` in `js/app.js`
    - `init` attaches a `submit` listener to `#name-form` and pre-fills `#name-input` with the stored name if present
    - `_onSubmit` trims the input; if non-empty, calls `App.Storage.set('pd_userName', trimmed)` and triggers `App.Greeting._renderGreeting()`; if empty/whitespace, retains the previous value silently
    - `#name-input` has `maxlength="50"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for user name persistence round-trip (Property 4)
    - **Property 4: User name persistence round-trip**
    - **Validates: Requirements 2.2, 2.4**
    - Use `fc.string({minLength:1})` with optional whitespace padding; assert trimmed value is stored and displayed
    - Add to `tests/greeting.test.js`

  - [ ] 5.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for whitespace-only input rejection (Property 5)
    - **Property 5: Whitespace-only input is rejected**
    - **Validates: Requirements 2.3, 5.4, 6.4**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n'), {minLength:1})`; assert stored value is unchanged
    - Add to `tests/greeting.test.js`

- [ ] 6. Checkpoint — Open the app in a browser and verify tasks 3–5 work correctly
  - Theme toggle switches light/dark and persists across reload
  - Clock ticks every second, date is correct, greeting phrase matches time of day
  - Name form saves and displays the name in the greeting
  - _(Skip if no test tasks were completed — manual browser check is sufficient)_

- [ ] 7. Implement `App.Timer` (Pomodoro countdown)
  - [ ] 7.1 Implement `App.Timer` state machine in `js/app.js`: `init()`, `start()`, `stop()`, `reset()`, `_tick()`, `_onComplete()`, `_render()`, and `_formatTime(secs)`
    - `init` loads `pd_pomoDuration` via `App.Storage.get`, sets `_configured` and `_remaining` in seconds, calls `_render()`
    - `start` guards against duplicate intervals (`_isRunning` check), sets `_isRunning = true`, disables `#timer-start`, starts `setInterval` calling `_tick` every 1 000 ms
    - `stop` clears the interval, sets `_isRunning = false`, re-enables `#timer-start`
    - `reset` calls `stop`, sets `_remaining = _configured`, calls `_render()`
    - `_tick` decrements `_remaining`; if `_remaining <= 0` calls `_onComplete()`; else calls `_render()`
    - `_onComplete` clears interval, sets `_isRunning = false`, shows `#timer-complete-msg`, synthesizes a beep via Web Audio API (wrapped in try/catch)
    - `_formatTime(secs)` returns zero-padded `"MM:SS"` string
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ] 7.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for timer reset (Property 6)
    - **Property 6: Timer reset always restores configured duration**
    - **Validates: Requirements 3.5**
    - Use `fc.integer({min:1,max:120})` for configured duration and arbitrary timer states; assert `_remaining === _configured` and `_isRunning === false` after `reset()`
    - Create `tests/timer.test.js`

  - [ ] 7.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for start button disabled while running (Property 7)
    - **Property 7: Start button disabled while timer is running**
    - **Validates: Requirements 3.8**
    - Assert `#timer-start` has `disabled` attribute whenever `_isRunning === true`
    - Add to `tests/timer.test.js`

- [ ] 8. Implement `App.TimerConfig` (duration configuration)
  - [ ] 8.1 Implement `App.TimerConfig.init()`, `App.TimerConfig._onApply(e)`, and `App.TimerConfig._validate(value)` in `js/app.js`
    - `init` loads saved duration, populates `#duration-input`, attaches click listener to `#duration-apply`
    - `_validate` returns `{ valid: true, minutes }` for integers 1–120; returns `{ valid: false, message }` otherwise
    - `_onApply` calls `_validate`; on success: stops any active countdown, sets `App.Timer._configured` and `App.Timer._remaining`, calls `App.Timer._render()`, persists via `App.Storage.set('pd_pomoDuration', minutes)`; on failure: shows error in `#duration-error`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 8.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for valid duration applied and persisted (Property 8)
    - **Property 8: Valid Pomodoro duration is applied and persisted**
    - **Validates: Requirements 4.2, 4.6**
    - Use `fc.integer({min:1,max:120})`; assert `_configured === d * 60`, display shows `d:00`, and `localStorage` key `pd_pomoDuration === d`
    - Add to `tests/timer.test.js`

  - [ ] 8.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for invalid duration rejected (Property 9)
    - **Property 9: Invalid Pomodoro duration is rejected**
    - **Validates: Requirements 4.3**
    - Use `fc.oneof(fc.integer({max:0}), fc.integer({min:121}), fc.float(), fc.string())`; assert `_configured` unchanged, error shown, no `localStorage` write
    - Add to `tests/timer.test.js`

  - [ ] 8.4 **[OPTIONAL — requires Node.js + Jest]** Write property test for duration load round-trip (Property 10)
    - **Property 10: Pomodoro duration load round-trip**
    - **Validates: Requirements 4.4**
    - Use `fc.integer({min:1,max:120})`; pre-populate `localStorage`, call `App.Timer.init()`, assert `_configured === d * 60` and display shows `d:00`
    - Add to `tests/timer.test.js`

- [ ] 9. Checkpoint — Open the app in a browser and verify tasks 7–8 work correctly
  - Timer starts, stops, and resets correctly
  - Start button is disabled while counting down
  - "Session complete!" message and beep appear at 00:00
  - Custom duration applies and persists across reload
  - _(Skip if no test tasks were completed — manual browser check is sufficient)_

- [ ] 10. Implement `App.Todo` (to-do list CRUD and sort)
  - [ ] 10.1 Implement `App.Todo` core data operations in `js/app.js`: `init()`, `addTask(description)`, `editTask(id, newDescription)`, `toggleComplete(id)`, `deleteTask(id)`, `_persist()`, and `_getSorted()`
    - `init` loads `pd_tasks` via `App.Storage.get`, sets `_tasks`, calls `_render()`
    - `addTask` trims description; rejects empty/whitespace (show error in `#task-error`); rejects case-insensitive duplicates (show warning); otherwise creates `{ id, description, completed: false, createdAt }`, pushes to `_tasks`, clears `#task-input`, calls `_persist()` and `_render()`
    - `editTask` validates non-empty trimmed description (≤ 200 chars); updates `_tasks[i].description`, calls `_persist()` and `_render()`
    - `toggleComplete` flips `completed`, calls `_persist()` and `_render()`
    - `deleteTask` removes task by id, calls `_persist()` and `_render()`
    - `_persist` calls `App.Storage.set('pd_tasks', _tasks)`; shows error in `#task-error` if `!result.ok`
    - `_getSorted` returns a sorted copy without mutating `_tasks`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 10.2 Implement `App.Todo._render()`, `App.Todo._renderItem(task)`, `App.Todo.setSort(mode)`, and `App.Todo._handleEvent(e)` in `js/app.js`
    - `_render` rebuilds `#task-list` innerHTML using `_getSorted()` and `_renderItem`
    - `_renderItem` returns an HTML string with checkbox, description span, edit button (`aria-label="Edit task"`), and delete button (`aria-label="Delete task"`)
    - Completed tasks receive `class="completed"` (strikethrough + reduced opacity via CSS)
    - `setSort` sets `_sortMode` and calls `_render()`; sort options: `'default'`, `'az'`, `'za'`, `'completed-last'`
    - `_handleEvent` uses event delegation on `#task-list` to handle checkbox change, edit button click, delete button click, and inline edit confirm/cancel (Escape key)
    - Attach `change` listener to `#task-sort` calling `setSort`
    - _Requirements: 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 10.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for task addition round-trip (Property 11)
    - **Property 11: Task addition round-trip**
    - **Validates: Requirements 5.2, 5.6**
    - Use `fc.string({minLength:1,maxLength:200})` filtered to non-whitespace; assert count increases by 1, new task has `completed: false`, and `pd_tasks` in `localStorage` contains the new task
    - Create `tests/todo.test.js`

  - [ ] 10.4 **[OPTIONAL — requires Node.js + Jest]** Write property test for input cleared after task addition (Property 12)
    - **Property 12: Input field cleared after successful task addition**
    - **Validates: Requirements 5.3**
    - Assert `#task-input.value === ''` after any valid `addTask` call
    - Add to `tests/todo.test.js`

  - [ ] 10.5 **[OPTIONAL — requires Node.js + Jest]** Write property test for duplicate task rejection (Property 13)
    - **Property 13: Duplicate task description is rejected**
    - **Validates: Requirements 5.5**
    - Use existing task description with case/whitespace variants; assert `_tasks.length` unchanged and warning shown
    - Add to `tests/todo.test.js`

  - [ ] 10.6 **[OPTIONAL — requires Node.js + Jest]** Write property test for task edit round-trip (Property 14)
    - **Property 14: Task edit round-trip**
    - **Validates: Requirements 6.3, 6.6**
    - Use `fc.string({minLength:1,maxLength:200})`; assert `_tasks[i].description` updated and `pd_tasks` in `localStorage` reflects the change
    - Add to `tests/todo.test.js`

  - [ ] 10.7 **[OPTIONAL — requires Node.js + Jest]** Write property test for completion toggle round-trip (Property 15)
    - **Property 15: Task completion toggle round-trip**
    - **Validates: Requirements 7.2, 7.3, 7.6**
    - Toggle to `true` then back to `false`; assert `completed === false` and `localStorage` updated
    - Add to `tests/todo.test.js`

  - [ ] 10.8 **[OPTIONAL — requires Node.js + Jest]** Write property test for task deletion round-trip (Property 16)
    - **Property 16: Task deletion round-trip**
    - **Validates: Requirements 7.5, 7.7**
    - Use `fc.array(taskArbitrary, {minLength:1})`; delete a random task; assert absent from `_tasks` and `localStorage`
    - Add to `tests/todo.test.js`

  - [ ] 10.9 **[OPTIONAL — requires Node.js + Jest]** Write property test for sort not mutating stored order (Property 17)
    - **Property 17: Sort does not mutate stored insertion order**
    - **Validates: Requirements 8.2**
    - Use `fc.array(taskArbitrary)` and `fc.constantFrom('az','za','completed-last')`; assert `pd_tasks` in `localStorage` preserves insertion order after sort
    - Add to `tests/todo.test.js`

  - [ ] 10.10 **[OPTIONAL — requires Node.js + Jest]** Write property test for new task appended to stored list (Property 18)
    - **Property 18: New task appended to stored list regardless of active sort**
    - **Validates: Requirements 8.4**
    - Use `fc.array(taskArbitrary)` + sort mode + new task; assert new task is last element in `pd_tasks` array in `localStorage`
    - Add to `tests/todo.test.js`

  - [ ] 10.11 **[OPTIONAL — requires Node.js + Jest]** Write property test for task list load round-trip (Property 19)
    - **Property 19: Task list load round-trip**
    - **Validates: Requirements 9.1, 9.3**
    - Use `fc.array(taskArbitrary)`; pre-populate `localStorage`, call `App.Todo.init()`, assert all tasks rendered with correct descriptions and completion statuses in insertion order
    - Add to `tests/todo.test.js`

- [ ] 11. Checkpoint — Open the app in a browser and verify task 10 works correctly
  - Add, edit, complete, and delete tasks
  - Duplicate task is rejected with a warning
  - All four sort modes work correctly
  - Tasks persist across page reload
  - _(Skip if no test tasks were completed — manual browser check is sufficient)_

- [ ] 12. Implement `App.Links` (quick links panel)
  - [ ] 12.1 Implement `App.Links` core operations in `js/app.js`: `init()`, `addLink(label, url)`, `deleteLink(id)`, `_validateUrl(url)`, `_persist()`, `_render()`, `_renderItem(link)`, and `_handleEvent(e)`
    - `init` loads `pd_links` via `App.Storage.get`, sets `_links`, calls `_render()`
    - `_validateUrl` returns `true` if URL starts with `http://` or `https://` and has a non-empty host (use `new URL()` wrapped in try/catch)
    - `addLink` validates: non-empty label (≤ 100 chars), valid URL, no duplicate URL, count < 50; on failure shows specific error in `#link-error`; on success creates `{ id, label, url }`, pushes to `_links`, calls `_persist()` and `_render()`
    - `deleteLink` removes link by id, calls `_persist()` and `_render()`
    - `_persist` calls `App.Storage.set('pd_links', _links)`; shows error if `!result.ok`
    - `_render` rebuilds `#links-list`; shows `#links-empty` message when `_links` is empty
    - `_renderItem` returns HTML string with an `<a target="_blank" rel="noopener noreferrer">` anchor and a delete button (`aria-label="Delete link"`)
    - `_handleEvent` uses event delegation on `#links-list` for delete button clicks
    - Attach click listener to `#link-add-btn`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [ ] 12.2 **[OPTIONAL — requires Node.js + Jest]** Write property test for quick link addition round-trip (Property 20)
    - **Property 20: Quick link addition round-trip**
    - **Validates: Requirements 10.4**
    - Use valid label and URL arbitraries; assert count increases by 1, link appears in rendered panel, `pd_links` in `localStorage` updated
    - Create `tests/links.test.js`

  - [ ] 12.3 **[OPTIONAL — requires Node.js + Jest]** Write property test for invalid quick link rejection (Property 21)
    - **Property 21: Invalid quick link is rejected**
    - **Validates: Requirements 10.5**
    - Use invalid input arbitraries (empty label, bad URL, duplicate URL, count at 50); assert `_links` unchanged and specific error shown
    - Add to `tests/links.test.js`

  - [ ] 12.4 **[OPTIONAL — requires Node.js + Jest]** Write property test for quick link deletion round-trip (Property 22)
    - **Property 22: Quick link deletion round-trip**
    - **Validates: Requirements 10.7**
    - Use `fc.array(linkArbitrary, {minLength:1})`; delete a random link; assert absent from `_links` and `localStorage`
    - Add to `tests/links.test.js`

  - [ ] 12.5 **[OPTIONAL — requires Node.js + Jest]** Write property test for quick links load round-trip (Property 23)
    - **Property 23: Quick links load round-trip**
    - **Validates: Requirements 10.8**
    - Use `fc.array(linkArbitrary)`; pre-populate `localStorage`, call `App.Links.init()`, assert all links rendered as clickable elements with correct labels and URLs
    - Add to `tests/links.test.js`

- [ ] 13. Implement `App.init()` bootstrap and wire all modules
  - [ ] 13.1 Implement `App.init()` in `js/app.js` and attach it to `DOMContentLoaded`
    - Call `App.Theme.init()`, `App.Greeting.init()`, `App.NameInput.init()`, `App.Timer.init()`, `App.TimerConfig.init()`, `App.Todo.init()`, `App.Links.init()` in that order
    - Attach `click` listener to `#theme-toggle` calling `App.Theme.toggle()`
    - Attach `click` listeners to `#timer-start`, `#timer-stop`, `#timer-reset` calling `App.Timer.start()`, `App.Timer.stop()`, `App.Timer.reset()`
    - Ensure `document.addEventListener('DOMContentLoaded', App.init)` is the last line of `js/app.js`
    - _Requirements: 12.3_

- [ ] 14. Apply accessibility enhancements across all widgets
  - [ ] 14.1 Audit and complete ARIA attributes in `index.html` and `js/app.js`
    - Verify all icon-only buttons have `aria-label` (theme toggle, timer controls, task edit/delete, link delete)
    - Add `aria-describedby` linking each input to its `#*-error` element
    - Confirm `#timer-complete-msg` has `aria-live="polite"`
    - Confirm all `#*-error` elements have `aria-live="polite"` so screen readers announce errors
    - Verify Tab order is logical across all widgets
    - Ensure `<a>` elements for quick links have descriptive text or `aria-label`
    - _Requirements: 12.3_ (accessibility is implicit in all requirements)

- [ ] 15. **[OPTIONAL — requires Node.js + Jest]** Set up test infrastructure and install dependencies
  - [ ] 15.1 **[OPTIONAL — requires Node.js + Jest]** Create `package.json` with Jest and fast-check dev dependencies
    - Add `"jest"`, `"jest-environment-jsdom"`, and `"fast-check"` as `devDependencies` with pinned versions
    - Add test script: `"test": "jest --testEnvironment jsdom --runInBand"`
    - Add `jest.config.js` (or inline Jest config) setting `testEnvironment: 'jsdom'` and `testMatch: ['**/tests/**/*.test.js']`
    - Create `tests/` directory with empty `storage.test.js`, `greeting.test.js`, `timer.test.js`, `todo.test.js`, `links.test.js`, `theme.test.js` stubs
    - To run tests: `npm install` then `npm test`

- [ ] 16. **[OPTIONAL — requires Node.js + Jest]** Final checkpoint — Ensure all tests pass
  - Run `npm test` and confirm all test suites pass with no failures

---

## Notes

- Tasks marked **[OPTIONAL — requires Node.js + Jest]** need Node.js (v18+) and `npm install` to run. Skip them freely — the app is fully functional without them.
- All other tasks produce a working browser app with no build tools or npm required.
- Checkpoints (tasks 6, 9, 11) are manual browser checks when tests are skipped, or automated test runs when tests are present.
- Property tests validate universal correctness properties across many generated inputs (minimum 100 iterations each).
- The `App` namespace pattern avoids ES modules, keeping the single-file constraint intact.
- `crypto.randomUUID()` is used for IDs with a `Math.random()` + `Date.now()` fallback for older browsers.
- All `localStorage` operations go through `App.Storage` — never call `localStorage` directly from widget modules.
- Error messages auto-clear after 5 seconds or on next user interaction with the widget.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1"] },
    { "id": 1, "tasks": ["3.1", "15.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "10.1"] },
    { "id": 7, "tasks": ["10.2"] },
    { "id": 8, "tasks": ["10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "12.1"] },
    { "id": 9, "tasks": ["12.2", "12.3", "12.4", "12.5", "13.1"] },
    { "id": 10, "tasks": ["14.1", "16"] }
  ]
}
```
