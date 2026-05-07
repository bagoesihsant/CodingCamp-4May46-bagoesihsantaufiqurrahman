# Design Document: Personal Dashboard

## Overview

The Personal Dashboard is a single-page web application (SPA) built entirely with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, no backend. All state is persisted in the browser's `localStorage`. The app is deployed via GitHub Pages and must work offline after the initial load.

The dashboard provides six interactive widgets:
1. **Greeting Widget** — live clock, date, and time-of-day greeting with optional user name
2. **Pomodoro Focus Timer** — configurable countdown timer with audible/visible completion
3. **To-Do List** — full CRUD with duplicate prevention, sorting, and persistence
4. **Quick Links Panel** — bookmarks with URL validation and a 50-link cap
5. **Light/Dark Mode Toggle** — theme switching with `prefers-color-scheme` fallback
6. **Custom Name** — user-settable display name persisted to localStorage

### Design Goals

- **Zero dependencies**: no npm, no CDN libraries, no external fonts required for functionality
- **Single-file JS**: all logic lives in `js/app.js`; modules are simulated via immediately-invoked function expressions (IIFEs) or a namespace object
- **Graceful degradation**: if localStorage is unavailable the app still renders and operates in-memory
- **Accessibility**: semantic HTML, ARIA labels on icon-only controls, keyboard-navigable interactions

---

## Architecture

The app follows a **module-namespace pattern** inside a single `js/app.js` file. A top-level `App` object acts as a namespace, with each widget implemented as a sub-object (e.g., `App.Greeting`, `App.Timer`, `App.Todo`, `App.Links`, `App.Theme`). A shared `App.Storage` utility wraps all `localStorage` calls.

```
index.html
├── css/style.css          (all styles, CSS custom properties for theming)
└── js/app.js              (all logic)
    ├── App.Storage        (localStorage read/write/error handling)
    ├── App.Greeting       (clock, date, greeting, user name)
    ├── App.Timer          (Pomodoro countdown, duration config)
    ├── App.Todo           (task CRUD, sort, persistence)
    ├── App.Links          (quick links CRUD, validation, persistence)
    ├── App.Theme          (light/dark toggle, prefers-color-scheme)
    └── App.init()         (bootstraps all modules on DOMContentLoaded)
```

### Rendering Strategy

The app uses **direct DOM manipulation** — no virtual DOM, no templating engine. Each module owns a section of the DOM (identified by `id` attributes in `index.html`) and re-renders its list/display by rebuilding `innerHTML` or updating specific element properties. Re-renders are scoped to the smallest necessary subtree to avoid unnecessary reflows.

### Event Handling

All event listeners are attached once during `App.init()` (or each module's `init()` call). List-level interactions (edit, delete, complete, delete link) use **event delegation** on the container element to avoid attaching per-item listeners.

### Timing

The live clock uses a single `setInterval` (1 000 ms) started in `App.Greeting.init()`. The Pomodoro countdown uses a separate `setInterval` managed by `App.Timer`, stored in a module-level variable so it can be cleared on stop/reset.

---

## Components and Interfaces

### App.Storage

Wraps `localStorage` with error handling. All reads return a parsed value or a default; all writes catch `QuotaExceededError` and surface an error to the caller.

```js
App.Storage = {
  get(key, defaultValue),   // returns parsed JSON or defaultValue
  set(key, value),          // serializes to JSON; returns { ok: true } or { ok: false, error }
  remove(key),              // removes key
};
```

**localStorage keys used:**

| Key | Type | Description |
|-----|------|-------------|
| `pd_userName` | `string` | User's display name |
| `pd_pomoDuration` | `number` | Pomodoro duration in minutes |
| `pd_tasks` | `Task[]` | Array of task objects |
| `pd_links` | `QuickLink[]` | Array of quick-link objects |
| `pd_theme` | `"light" \| "dark"` | Active theme |

---

### App.Greeting

Manages the greeting widget DOM section (`#greeting-widget`).

```js
App.Greeting = {
  init(),           // starts clock interval, renders initial state
  _tick(),          // called every second: updates time display
  _renderDate(),    // updates date display
  _renderGreeting(),// updates greeting text based on hour + stored name
  _getGreetingPhrase(hour),  // returns "Good Morning" | "Good Afternoon" | "Good Evening"
};
```

**DOM elements owned:**
- `#clock` — time display
- `#date-display` — date display
- `#greeting-text` — greeting phrase + name

---

### App.NameInput

Manages the name input form (`#name-form`).

```js
App.NameInput = {
  init(),           // attaches submit listener
  _onSubmit(e),     // validates, saves, triggers greeting re-render
};
```

**DOM elements owned:**
- `#name-input` — text input (maxlength=50)
- `#name-form` — form wrapper
- `#name-error` — inline error/feedback area

---

### App.Timer

Manages the Pomodoro timer section (`#timer-widget`).

```js
App.Timer = {
  _intervalId: null,
  _remaining: 0,       // seconds remaining
  _configured: 0,      // configured duration in seconds
  _isRunning: false,

  init(),              // loads duration from storage, renders initial display
  start(),             // begins or resumes countdown
  stop(),              // pauses countdown
  reset(),             // stops and resets to configured duration
  _tick(),             // decrements _remaining, updates display, checks completion
  _onComplete(),       // plays alert, shows "Session complete!" message
  _render(),           // updates MM:SS display and button states
  _formatTime(secs),   // returns "MM:SS" string
};
```

**DOM elements owned:**
- `#timer-display` — MM:SS countdown
- `#timer-start` — start/resume button
- `#timer-stop` — stop/pause button
- `#timer-reset` — reset button
- `#timer-complete-msg` — "Session complete!" message (hidden by default)

**Audible alert:** Uses the Web Audio API (`AudioContext`) to synthesize a short beep tone, avoiding the need for an external audio file.

---

### App.TimerConfig

Manages the duration configuration form (`#timer-config`).

```js
App.TimerConfig = {
  init(),             // loads saved duration, populates input, attaches listener
  _onApply(e),        // validates input, updates App.Timer, persists
  _validate(value),   // returns { valid: true, minutes } or { valid: false, message }
};
```

**DOM elements owned:**
- `#duration-input` — numeric input (min=1, max=120)
- `#duration-apply` — apply button
- `#duration-error` — inline error area

---

### App.Todo

Manages the to-do list section (`#todo-widget`).

```js
App.Todo = {
  _tasks: [],          // in-memory Task[]
  _sortMode: 'default',

  init(),              // loads from storage, renders
  addTask(description),
  editTask(id, newDescription),
  toggleComplete(id),
  deleteTask(id),
  setSort(mode),       // 'default' | 'az' | 'za' | 'completed-last'
  _getSorted(),        // returns sorted copy of _tasks (does not mutate _tasks)
  _render(),           // rebuilds #task-list innerHTML
  _renderItem(task),   // returns HTML string for one task row
  _persist(),          // calls App.Storage.set, shows error if failed
  _handleEvent(e),     // delegated event handler on #task-list
};
```

**DOM elements owned:**
- `#task-input` — text input (maxlength=200)
- `#task-add-btn` — add button
- `#task-error` — inline error/warning area
- `#task-sort` — `<select>` with sort options
- `#task-list` — `<ul>` container (event delegation target)

---

### App.Links

Manages the quick links panel (`#links-widget`).

```js
App.Links = {
  _links: [],          // in-memory QuickLink[]

  init(),              // loads from storage, renders
  addLink(label, url),
  deleteLink(id),
  _validateUrl(url),   // returns true if starts with http:// or https:// and has non-empty host
  _render(),           // rebuilds #links-list
  _renderItem(link),   // returns HTML string for one link
  _persist(),          // calls App.Storage.set, shows error if failed
  _handleEvent(e),     // delegated event handler on #links-list
};
```

**DOM elements owned:**
- `#link-label-input` — label input (maxlength=100)
- `#link-url-input` — URL input
- `#link-add-btn` — add button
- `#link-error` — inline error area
- `#links-list` — container (event delegation target)
- `#links-empty` — empty-state message

---

### App.Theme

Manages the theme toggle (`#theme-toggle`).

```js
App.Theme = {
  _current: 'light',

  init(),              // reads storage or prefers-color-scheme, applies theme
  toggle(),            // flips theme, persists
  _apply(theme),       // sets data-theme attribute on <html>, updates toggle icon/label
};
```

**DOM elements owned:**
- `#theme-toggle` — button with sun/moon icon
- `<html>` element — receives `data-theme="light"` or `data-theme="dark"` attribute

---

## Data Models

### Task

```js
{
  id: string,           // crypto.randomUUID() or Date.now().toString()
  description: string,  // trimmed, 1–200 characters
  completed: boolean,   // false on creation
  createdAt: number,    // Date.now() timestamp (preserves insertion order)
}
```

### QuickLink

```js
{
  id: string,           // crypto.randomUUID() or Date.now().toString()
  label: string,        // trimmed, 1–100 characters
  url: string,          // validated: starts with http:// or https://, non-empty host
}
```

### StoredState (localStorage shape)

```js
// pd_tasks  → JSON.stringify(Task[])
// pd_links  → JSON.stringify(QuickLink[])
// pd_theme  → "light" | "dark"
// pd_userName → string (max 50 chars)
// pd_pomoDuration → number (1–120)
```

### Theme CSS Custom Properties

Theming is implemented via CSS custom properties on `:root` scoped by `[data-theme]`:

```css
:root,
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #555555;
  --accent: #4a90e2;
  --border: #dddddd;
  --shadow: rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] {
  --bg-primary: #1e1e2e;
  --bg-secondary: #2a2a3e;
  --text-primary: #e0e0f0;
  --text-secondary: #a0a0c0;
  --accent: #7aa2f7;
  --border: #3a3a5a;
  --shadow: rgba(0, 0, 0, 0.4);
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Time formatting correctness

*For any* valid time value (hours 0–23, minutes 0–59, seconds 0–59), the `_formatTime` function SHALL produce a string matching the pattern `HH:MM:SS` (for the clock display) or `MM:SS` (for the timer display), with each component zero-padded to its required width.

**Validates: Requirements 1.1, 3.1**

---

### Property 2: Greeting phrase covers all hours

*For any* integer hour in the range 0–23, `_getGreetingPhrase(hour)` SHALL return exactly one of "Good Morning" (hours 5–11), "Good Afternoon" (hours 12–17), or "Good Evening" (hours 0–4 and 18–23), with no hour left unclassified and no hour mapped to more than one phrase.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 3: Greeting includes truncated name

*For any* non-empty User_Name string (including strings longer than 50 characters), the rendered greeting text SHALL contain the name truncated to at most 50 characters, and SHALL NOT contain more than 50 characters of the name.

**Validates: Requirements 1.6**

---

### Property 4: User name persistence round-trip

*For any* non-empty string (with optional leading/trailing whitespace), submitting it as a User_Name SHALL store the trimmed value in `localStorage` under `pd_userName`, and a subsequent load SHALL display the trimmed value in the Greeting_Widget.

**Validates: Requirements 2.2, 2.4**

---

### Property 5: Whitespace-only input is rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), submitting it as a User_Name or task description SHALL leave the previously stored value unchanged and SHALL display an inline error or warning message.

**Validates: Requirements 2.3, 5.4, 6.4**

---

### Property 6: Timer reset always restores configured duration

*For any* timer state (running, paused, or at zero), calling `reset()` SHALL set `_remaining` equal to `_configured` (in seconds) and SHALL set `_isRunning` to `false`.

**Validates: Requirements 3.5**

---

### Property 7: Start button disabled while timer is running

*For any* state in which the Pomodoro timer is actively counting down (`_isRunning === true`), the start control (`#timer-start`) SHALL have the `disabled` attribute set, preventing duplicate interval creation.

**Validates: Requirements 3.8**

---

### Property 8: Valid Pomodoro duration is applied and persisted

*For any* integer duration `d` in the range 1–120, applying `d` via the duration config form SHALL set `_configured` to `d * 60` seconds, stop any active countdown, update the timer display to `d:00`, and write `d` to `localStorage` under `pd_pomoDuration`.

**Validates: Requirements 4.2, 4.6**

---

### Property 9: Invalid Pomodoro duration is rejected

*For any* value outside the integer range 1–120 (including values ≤ 0, values > 120, non-integer numbers, and non-numeric strings), applying it as a Pomodoro duration SHALL leave `_configured` unchanged, SHALL display an inline error message, and SHALL NOT write to `localStorage`.

**Validates: Requirements 4.3**

---

### Property 10: Pomodoro duration load round-trip

*For any* valid duration `d` (1–120) stored in `localStorage` under `pd_pomoDuration`, loading the App SHALL initialize `_configured` to `d * 60` seconds and display `d:00` in the timer.

**Validates: Requirements 4.4**

---

### Property 11: Task addition round-trip

*For any* non-empty, non-duplicate task description (trimmed), adding it to the Task_List SHALL increase the task count by exactly 1, the new task SHALL appear in the rendered list with `completed: false`, and the complete Task_List (including the new task) SHALL be written to `localStorage` under `pd_tasks`.

**Validates: Requirements 5.2, 5.6**

---

### Property 12: Input field cleared after successful task addition

*For any* valid task addition, the task input field (`#task-input`) SHALL have an empty string value immediately after the task is added.

**Validates: Requirements 5.3**

---

### Property 13: Duplicate task description is rejected

*For any* task description already present in the Task_List, attempting to add the same description (in any combination of upper/lower case, with any leading/trailing whitespace) SHALL leave the Task_List unchanged and SHALL display an inline warning message.

**Validates: Requirements 5.5**

---

### Property 14: Task edit round-trip

*For any* existing task and any valid new description (non-empty, trimmed, at most 200 characters), confirming the edit SHALL update the task's `description` field in `_tasks`, re-render the task in display mode, and write the updated Task_List to `localStorage` under `pd_tasks`.

**Validates: Requirements 6.3, 6.6**

---

### Property 15: Task completion toggle round-trip

*For any* task, toggling its completion status to `true` and then back to `false` SHALL result in `completed === false`, the default display style (no strikethrough, full opacity), and the updated status persisted to `localStorage`.

**Validates: Requirements 7.2, 7.3, 7.6**

---

### Property 16: Task deletion round-trip

*For any* task present in the Task_List, deleting it SHALL result in the task being absent from both `_tasks` and the rendered list, and the updated Task_List (without the deleted task) SHALL be written to `localStorage` under `pd_tasks`.

**Validates: Requirements 7.5, 7.7**

---

### Property 17: Sort does not mutate stored insertion order

*For any* Task_List and any sort mode (A–Z, Z–A, Completed Last), applying the sort SHALL reorder the rendered list according to the selected mode but SHALL NOT change the order of tasks stored in `localStorage` under `pd_tasks` (which always reflects insertion order).

**Validates: Requirements 8.2**

---

### Property 18: New task appended to stored list regardless of active sort

*For any* active sort mode and any valid new task description, adding the task SHALL append it as the last element in the `pd_tasks` array in `localStorage`, and the displayed list SHALL reflect the current sort applied to the updated stored list.

**Validates: Requirements 8.4**

---

### Property 19: Task list load round-trip

*For any* set of tasks stored in `localStorage` under `pd_tasks`, loading the App SHALL render all tasks with their correct descriptions and completion statuses, in insertion order (default sort).

**Validates: Requirements 9.1, 9.3**

---

### Property 20: Quick link addition round-trip

*For any* valid Quick_Link (non-empty label ≤ 100 chars, URL starting with `http://` or `https://` with non-empty host, not a duplicate, total count < 50), adding it SHALL increase the link count by 1, the link SHALL appear in the rendered panel, and the updated list SHALL be written to `localStorage` under `pd_links`.

**Validates: Requirements 10.4**

---

### Property 21: Invalid quick link is rejected

*For any* invalid Quick_Link submission (empty label, URL not starting with `http://`/`https://`, missing host, duplicate URL, or count already at 50), the Quick_Links list SHALL remain unchanged and an inline error message describing the specific reason SHALL be displayed.

**Validates: Requirements 10.5**

---

### Property 22: Quick link deletion round-trip

*For any* Quick_Link present in the panel, deleting it SHALL result in the link being absent from both `_links` and the rendered panel, and the updated list SHALL be written to `localStorage` under `pd_links`.

**Validates: Requirements 10.7**

---

### Property 23: Quick links load round-trip

*For any* set of Quick_Links stored in `localStorage` under `pd_links`, loading the App SHALL render all links as clickable elements with correct labels and URLs.

**Validates: Requirements 10.8**

---

### Property 24: Theme persistence round-trip

*For any* theme value ("light" or "dark"), toggling to that theme SHALL write the value to `localStorage` under `pd_theme`, and a subsequent load SHALL apply that theme to the `<html>` element's `data-theme` attribute.

**Validates: Requirements 11.4**

---

## Error Handling

### localStorage Failures

All `localStorage` operations are wrapped in `App.Storage`, which catches exceptions and returns a structured result:

```js
// Write failure
const result = App.Storage.set('pd_tasks', tasks);
if (!result.ok) {
  showInlineError('#task-error', 'Could not save changes. Storage may be full.');
}

// Read failure (on load)
try {
  const tasks = App.Storage.get('pd_tasks', []);
} catch (e) {
  renderEmptyTaskList();
  showInlineError('#task-error', 'Could not load saved tasks.');
}
```

**Error display rules:**
- Inline errors appear in the nearest `#*-error` element to the affected widget
- Errors auto-clear after 5 seconds or when the user next interacts with the widget
- Errors do not block the UI — the app continues operating in-memory

### Input Validation Errors

Each widget validates its inputs before processing:

| Widget | Invalid condition | Error message |
|--------|------------------|---------------|
| Name input | Empty/whitespace | (silent — retain previous name) |
| Timer config | Out of range or non-integer | "Please enter a whole number between 1 and 120." |
| Task add | Empty/whitespace | "Task description cannot be empty." |
| Task add | Duplicate | "A task with this description already exists." |
| Task edit | Empty/whitespace | "Task description cannot be empty." |
| Link add | Empty label | "Please enter a label for the link." |
| Link add | Invalid URL | "URL must start with http:// or https:// and include a domain." |
| Link add | Duplicate URL | "This URL is already in your links." |
| Link add | 50-link cap reached | "You have reached the maximum of 50 links." |

### Audio Context Failure

The Web Audio API `AudioContext` may be unavailable or suspended in some browsers. The `_onComplete()` method wraps the beep synthesis in a try/catch — if audio fails, the visual "Session complete!" message still appears.

### Missing `crypto.randomUUID`

For browsers that do not support `crypto.randomUUID()`, a fallback ID generator using `Math.random()` and `Date.now()` is used:

```js
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
```

---

## Testing Strategy

### Overview

This project uses a **dual testing approach**:
- **Unit/example tests**: verify specific behaviors, edge cases, and error conditions
- **Property-based tests**: verify universal properties across many generated inputs

The property-based testing library chosen is **[fast-check](https://fast-check.dev/)** (JavaScript), run via a simple test harness. Since the app has no build system, tests are written in a separate `tests/` directory and run with Node.js using `node --experimental-vm-modules` or a minimal test runner.

> **Note:** Because the app uses vanilla JS with no module system, the testable logic (pure functions like `_formatTime`, `_getGreetingPhrase`, `_validateUrl`, `_validate` for duration, task/link validation) will be extracted into testable units. DOM-dependent behavior is tested with a lightweight DOM mock (e.g., `jsdom`).

### Property-Based Tests

Each property test runs a minimum of **100 iterations**. Tests are tagged with a comment referencing the design property.

**Tag format:** `// Feature: personal-dashboard, Property N: <property_text>`

| Property | Test description | Generator |
|----------|-----------------|-----------|
| P1 | Time formatting | `fc.integer({min:0,max:23})`, `fc.integer({min:0,max:59})` × 2 |
| P2 | Greeting phrase covers all hours | `fc.integer({min:0,max:23})` |
| P3 | Greeting includes truncated name | `fc.string({minLength:1,maxLength:200})` |
| P4 | User name persistence round-trip | `fc.string({minLength:1})` with whitespace padding |
| P5 | Whitespace-only input rejected | `fc.stringOf(fc.constantFrom(' ','\t','\n'))` |
| P6 | Timer reset restores configured | Any timer state + `fc.integer({min:1,max:120})` |
| P7 | Start disabled while running | Timer in running state |
| P8 | Valid duration applied and persisted | `fc.integer({min:1,max:120})` |
| P9 | Invalid duration rejected | `fc.oneof(fc.integer({max:0}), fc.integer({min:121}), fc.float(), fc.string())` |
| P10 | Duration load round-trip | `fc.integer({min:1,max:120})` |
| P11 | Task addition round-trip | `fc.string({minLength:1,maxLength:200})` (non-whitespace) |
| P12 | Input cleared after add | `fc.string({minLength:1,maxLength:200})` |
| P13 | Duplicate task rejected | Existing task + case/whitespace variants |
| P14 | Task edit round-trip | `fc.string({minLength:1,maxLength:200})` |
| P15 | Completion toggle round-trip | Any task |
| P16 | Task deletion round-trip | Any task list + random index |
| P17 | Sort does not mutate stored order | `fc.array(taskArbitrary)` + sort mode |
| P18 | New task appended to stored list | `fc.array(taskArbitrary)` + sort mode + new task |
| P19 | Task list load round-trip | `fc.array(taskArbitrary)` |
| P20 | Quick link addition round-trip | Valid label + valid URL arbitraries |
| P21 | Invalid quick link rejected | Invalid input arbitraries |
| P22 | Quick link deletion round-trip | `fc.array(linkArbitrary)` + random index |
| P23 | Quick links load round-trip | `fc.array(linkArbitrary)` |
| P24 | Theme persistence round-trip | `fc.constantFrom('light','dark')` |

### Unit / Example Tests

Unit tests cover:
- Specific initialization states (default duration = 25 min, empty task list, empty links, no name)
- State machine transitions (start → stop → resume, timer reaching 00:00, applying duration while running)
- UI structure checks (edit control present, delete control present, sort options present)
- Error handling paths (storage write failure, storage read failure, audio context failure)
- Edge cases (50-link cap, 200-char task limit, 100-char label limit)

### Test File Structure

```
tests/
├── greeting.test.js      (P1, P2, P3, P4, P5 — greeting/name)
├── timer.test.js         (P6, P7, P8, P9, P10 — timer logic)
├── todo.test.js          (P11–P19 — task CRUD, sort, persistence)
├── links.test.js         (P20–P23 — quick links)
├── theme.test.js         (P24 — theme toggle)
└── storage.test.js       (App.Storage error handling)
```

### Running Tests

```bash
# Install test dependencies (dev only, not bundled with the app)
npm install --save-dev fast-check jest jest-environment-jsdom

# Run all tests (single execution, no watch mode)
npx jest --testEnvironment jsdom
```

### Accessibility Testing

Manual testing checklist:
- All interactive controls are keyboard-reachable (Tab order)
- Icon-only buttons have `aria-label` attributes
- Error messages are associated with their inputs via `aria-describedby`
- Color contrast meets WCAG 2.1 AA in both light and dark themes
- Timer completion message is announced via `aria-live="polite"`
