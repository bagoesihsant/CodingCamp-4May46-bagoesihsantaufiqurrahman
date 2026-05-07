# Requirements Document

## Introduction

A personal dashboard web application (MVP) built with vanilla HTML, CSS, and JavaScript. The app runs entirely in the browser with no backend, using Local Storage for persistence. It provides a greeting widget, a Pomodoro focus timer, a to-do list, and a quick-links panel. Optional enhancements include a light/dark mode toggle, a customizable user name, adjustable Pomodoro duration, duplicate-task prevention, and task sorting.

The project follows strict folder rules: one CSS file inside `css/`, one JavaScript file inside `js/`, and a single `index.html` at the root. It is deployed via GitHub Pages.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **App**: Synonym for Dashboard.
- **LocalStorage**: The browser's `localStorage` Web Storage API used for client-side persistence.
- **Pomodoro_Timer**: The focus-timer widget that counts down from a configurable duration (default 25 minutes).
- **Task**: A to-do item with a description, completion status, and unique identifier.
- **Task_List**: The ordered collection of Tasks managed by the App.
- **Quick_Link**: A user-defined bookmark consisting of a label and a URL.
- **Quick_Links_Panel**: The UI section that displays and manages Quick_Links.
- **Theme**: The visual color scheme of the App, either "light" or "dark".
- **User_Name**: The display name shown in the greeting, stored in LocalStorage.
- **Greeting_Widget**: The UI section that shows the current time, date, and a time-of-day greeting.

---

## Requirements

### Requirement 1: Greeting Widget

**User Story:** As a user, I want to see the current time, date, and a contextual greeting, so that I have an at-a-glance overview when I open the dashboard.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current local time in HH:MM:SS (24-hour) format, updated every second.
2. THE Greeting_Widget SHALL display the current local date in the format "Weekday, D Month YYYY" (e.g., "Monday, 5 May 2025").
3. IF the local hour is between 05 and 11 (inclusive), THEN THE Greeting_Widget SHALL display the greeting "Good Morning".
4. IF the local hour is between 12 and 17 (inclusive), THEN THE Greeting_Widget SHALL display the greeting "Good Afternoon".
5. IF the local hour is between 18 and 23 (inclusive) or between 0 and 4 (inclusive), THEN THE Greeting_Widget SHALL display the greeting "Good Evening".
6. WHERE a User_Name has been saved, THE Greeting_Widget SHALL append the User_Name (truncated to 50 characters if longer) to the greeting (e.g., "Good Morning, Alex").
7. WHEN no User_Name has been saved, THE Greeting_Widget SHALL display the greeting without a name suffix.

---

### Requirement 2: Custom Name in Greeting

**User Story:** As a user, I want to set my name so that the greeting feels personal.

#### Acceptance Criteria

1. THE App SHALL provide an input field that allows the user to enter a User_Name of at most 50 characters.
2. WHEN the user submits a User_Name whose trimmed value is non-empty, THE App SHALL persist the trimmed User_Name to LocalStorage.
3. WHEN the user submits an empty or whitespace-only string as a User_Name, THE App SHALL retain the previously saved User_Name and not overwrite it.
4. WHEN the App loads and a User_Name exists in LocalStorage, THE App SHALL read the User_Name from LocalStorage and display it in the Greeting_Widget.
5. IF no User_Name exists in LocalStorage when the App loads, THEN THE App SHALL display the greeting without a name suffix (no default placeholder name).

---

### Requirement 3: Pomodoro Focus Timer

**User Story:** As a user, I want a countdown timer so that I can manage focused work sessions.

#### Acceptance Criteria

1. THE Pomodoro_Timer SHALL display a countdown in MM:SS format.
2. WHEN the App loads, THE Pomodoro_Timer SHALL initialize to the configured duration (between 1 and 120 minutes, default 25 minutes) and display it as MM:00.
3. WHEN the user activates the start control while the timer is at the configured duration or paused, THE Pomodoro_Timer SHALL begin counting down one second per second.
4. WHEN the user activates the stop control while the timer is counting down, THE Pomodoro_Timer SHALL pause the countdown at the current value and re-enable the start control.
5. WHEN the user activates the reset control, THE Pomodoro_Timer SHALL stop counting and return the display to the configured duration.
6. WHEN the user activates the start control while the timer is paused, THE Pomodoro_Timer SHALL resume counting down from the current paused value.
7. WHEN the countdown reaches 00:00, THE Pomodoro_Timer SHALL stop automatically, play an audible alert sound, and display a visible "Session complete!" message.
8. WHILE the Pomodoro_Timer is counting down, THE App SHALL disable the start control to prevent duplicate intervals.
9. WHEN the user activates the start control after the timer has reached 00:00, THE Pomodoro_Timer SHALL reset to the configured duration and begin counting down.

---

### Requirement 4: Customizable Pomodoro Duration

**User Story:** As a user, I want to change the Pomodoro duration so that I can adapt the timer to my preferred work intervals.

#### Acceptance Criteria

1. THE App SHALL provide a numeric input that allows the user to set the Pomodoro duration in whole minutes (minimum 1, maximum 120).
2. WHEN the user sets a valid duration and activates the apply control, THE App SHALL update the Pomodoro_Timer display to the new duration (MM:00) and stop any active countdown, regardless of whether the timer was running or idle.
3. WHEN the user enters a value outside the range 1–120 or a non-integer value, THE App SHALL reject the input, display an inline error message, and retain the current duration.
4. WHEN the App loads, THE App SHALL read the saved duration from LocalStorage.
5. IF no saved duration exists in LocalStorage, THEN THE App SHALL use 25 minutes as the default.
6. WHEN a valid duration is applied, THE App SHALL persist the duration to LocalStorage.
7. WHEN the user applies a new duration while the Pomodoro_Timer is actively counting down, THE App SHALL stop the countdown, apply the new duration, and reset the display to the new duration (MM:00).

---

### Requirement 5: To-Do List — Add Tasks

**User Story:** As a user, I want to add tasks to my to-do list so that I can capture things I need to accomplish.

#### Acceptance Criteria

1. THE App SHALL provide a text input (maximum 200 characters) and an add control for creating new Tasks.
2. WHEN the user submits a non-empty, non-duplicate task description (trimmed), THE Task_List SHALL create a new Task with a unique identifier and append it to the list.
3. WHEN a new Task is added, THE App SHALL clear the task input field.
4. WHEN the user submits an empty or whitespace-only task description, THE App SHALL reject the addition, display an inline error message, and leave the Task_List unchanged.
5. WHEN the user attempts to add a task description that already exists in the Task_List (case-insensitive, trimmed comparison), THE App SHALL reject the addition and display an inline warning message indicating the task already exists.
6. WHEN a Task is added, THE App SHALL persist the updated Task_List to LocalStorage immediately.

---

### Requirement 6: To-Do List — Edit Tasks

**User Story:** As a user, I want to edit existing tasks so that I can correct or update their descriptions.

#### Acceptance Criteria

1. THE App SHALL provide an edit control for each Task in the Task_List.
2. WHEN the user activates the edit control for a Task, THE App SHALL replace the task display with an editable input (maximum 200 characters) pre-filled with the current description.
3. WHEN the user confirms the edit with a non-empty, non-whitespace description (at most 200 characters), THE App SHALL update the Task description, return to display mode, and persist the updated Task_List to LocalStorage within 200ms.
4. WHEN the user confirms the edit with an empty or whitespace-only description, THE App SHALL reject the update, display an inline error message, and retain the original description.
5. WHEN the user cancels the edit (e.g., presses Escape or activates a cancel control), THE App SHALL discard the changes and return to display mode without modifying the Task.
6. WHEN a Task description is updated, THE App SHALL persist the updated Task_List to LocalStorage immediately.

---

### Requirement 7: To-Do List — Complete and Delete Tasks

**User Story:** As a user, I want to mark tasks as done and delete tasks so that I can manage my list effectively.

#### Acceptance Criteria

1. THE App SHALL provide a completion toggle (checkbox) for each Task.
2. WHEN the user toggles the completion control to complete a Task, THE App SHALL update the Task's completion status to true and visually distinguish it with strikethrough text and reduced opacity.
3. WHEN the user toggles the completion control to un-complete a Task, THE App SHALL update the Task's completion status to false and restore the default display style (no strikethrough, full opacity).
4. THE App SHALL provide a delete control for each Task.
5. WHEN the user activates the delete control, THE App SHALL remove the Task from the Task_List and remove it from the rendered list.
6. WHEN a Task's completion status changes, THE App SHALL persist the updated Task_List to LocalStorage within 300ms.
7. WHEN a Task is deleted, THE App SHALL persist the updated Task_List to LocalStorage before the next user interaction.

---

### Requirement 8: To-Do List — Sort Tasks

**User Story:** As a user, I want to sort my tasks so that I can prioritize and organize my list.

#### Acceptance Criteria

1. THE App SHALL provide a sort control with the following options: (a) Default (insertion order), (b) A–Z (alphabetical ascending, case-insensitive), (c) Z–A (alphabetical descending, case-insensitive), (d) Completed Last (incomplete tasks first, then completed tasks; within each group, insertion order is preserved).
2. WHEN the user selects a sort option, THE App SHALL reorder the displayed Task_List accordingly without altering the underlying stored insertion order in LocalStorage.
3. WHEN the App loads, THE App SHALL display Tasks in the default insertion order and set the sort control to the "Default" option.
4. WHEN a new Task is added while a non-default sort is active, THE App SHALL insert the Task into the stored list at the end and re-apply the current sort to the displayed list.
5. IF the Task_List is empty when a sort option is selected, THEN THE App SHALL display an empty list without error.

---

### Requirement 9: To-Do List — Persistence

**User Story:** As a user, I want my tasks to be saved automatically so that they persist across browser sessions.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL read the Task_List from LocalStorage and render all saved Tasks with their descriptions and completion statuses.
2. IF no Task_List exists in LocalStorage, THEN THE App SHALL render an empty Task_List.
3. WHEN a Task is added, edited, completed, un-completed, or deleted, THE App SHALL persist the complete Task_List to LocalStorage.
4. IF a LocalStorage write operation fails (e.g., storage quota exceeded), THEN THE App SHALL display an inline error message informing the user that the change could not be saved.
5. IF a LocalStorage read operation fails on App load, THEN THE App SHALL render an empty Task_List and display an inline error message informing the user that saved tasks could not be loaded.

---

### Requirement 10: Quick Links Panel

**User Story:** As a user, I want to save and open favorite website links so that I can navigate quickly to frequently visited pages.

#### Acceptance Criteria

1. THE Quick_Links_Panel SHALL display all saved Quick_Links as clickable buttons or anchor elements.
2. WHEN the user activates a Quick_Link, THE App SHALL open the associated URL in a new browser tab.
3. THE App SHALL provide an add-link form with a label field (maximum 100 characters) and a URL field.
4. WHEN the user submits a non-empty label and a valid URL (starting with `http://` or `https://` with a non-empty host), and the total number of Quick_Links is below 50, and the URL is not a duplicate of an existing Quick_Link, THE Quick_Links_Panel SHALL add the new Quick_Link and persist the updated list to LocalStorage.
5. WHEN the user submits an empty label, an invalid URL (not starting with `http://` or `https://` or missing a host), a duplicate URL, or when the Quick_Links count has reached 50, THE App SHALL reject the addition and display an inline error message describing the specific reason.
6. THE App SHALL provide a delete control for each Quick_Link.
7. WHEN the user activates the delete control for a Quick_Link, THE Quick_Links_Panel SHALL remove the Quick_Link and persist the updated list to LocalStorage.
8. WHEN the App loads, THE App SHALL read the Quick_Links list from LocalStorage and render all saved Quick_Links.
9. IF no Quick_Links exist in LocalStorage, THEN THE Quick_Links_Panel SHALL render an empty state message (e.g., "No links saved yet").

---

### Requirement 11: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between light and dark themes so that I can use the dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the Theme between "light" and "dark", and the toggle SHALL visually indicate the currently active theme (e.g., sun/moon icon or label).
2. WHEN the user activates the theme toggle, THE App SHALL apply the selected Theme to all visible UI elements within 100ms.
3. WHEN the App loads, THE App SHALL read the saved Theme from LocalStorage; IF no saved Theme exists, THE App SHALL apply the system's preferred color scheme via `prefers-color-scheme`.
4. WHEN the Theme changes to a value different from the currently active Theme, THE App SHALL persist the selected Theme to LocalStorage.
5. IF LocalStorage is unavailable when the App loads, THEN THE App SHALL apply the system's preferred color scheme via `prefers-color-scheme` and continue operating without persistence.

---

### Requirement 12: Code Structure and Deployment

**User Story:** As a developer, I want the project to follow a clean folder structure and be deployed via GitHub Pages so that the app is maintainable and publicly accessible.

#### Acceptance Criteria

1. THE App SHALL contain exactly one CSS file located at `css/style.css`.
2. THE App SHALL contain exactly one JavaScript file located at `js/app.js`.
3. THE App SHALL contain a root `index.html` that references `css/style.css` via a `<link rel="stylesheet">` tag and `js/app.js` via a `<script>` tag, both loading without errors.
4. IF the repository is pushed to GitHub and GitHub Pages is enabled, THEN THE App SHALL be accessible at the repository's GitHub Pages URL, returning an HTTP 200 response and rendering the `index.html` content.
