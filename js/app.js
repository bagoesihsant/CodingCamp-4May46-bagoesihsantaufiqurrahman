/* ============================================================
   Personal Dashboard — js/app.js
   All logic lives here. No external dependencies.
   ============================================================ */

'use strict';

/* ============================================================
   Constants
   ============================================================ */
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ============================================================
   Utility: ID generation
   ============================================================ */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ============================================================
   Utility: SHA-256 hash (async, Web Crypto API)
   ============================================================ */
function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  return crypto.subtle.digest('SHA-256', data).then(function (hashBuffer) {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

/* ============================================================
   Utility: Error message display
   ============================================================ */
function showError(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'error-msg ' + (type === 'warning' ? 'is-warning' : 'is-error');
  clearTimeout(el._clearTimer);
  el._clearTimer = setTimeout(function () {
    clearMsg(elementId);
  }, 5000);
}

function clearMsg(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.className = 'error-msg';
}

/* ============================================================
   App Namespace
   ============================================================ */
const App = {};

/* ============================================================
   App.Storage — localStorage wrapper
   ============================================================ */
App.Storage = {
  get: function (key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      return defaultValue;
    }
  },

  set: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  },

  remove: function (key) {
    localStorage.removeItem(key);
  }
};

/* ============================================================
   App.Auth — registration, login, session, logout
   ============================================================ */
App.Auth = {
  _session: null,

  /* Returns the storage key scoped to a user id */
  scopedKey: function (userId, suffix) {
    return 'pd_' + userId + '_' + suffix;
  },

  /* Returns current logged-in user object or null */
  currentUser: function () {
    return this._session ? this._session.user : null;
  },

  /* Load session from localStorage and validate timeout */
  loadSession: function () {
    const session = App.Storage.get('pd_session', null);
    if (!session) { this._session = null; return; }
    if (Date.now() > session.expiresAt) {
      App.Storage.remove('pd_session');
      this._session = null;
      return;
    }
    this._session = session;
  },

  /* Register a new user. Returns a Promise resolving to {ok, error} */
  register: function (username, displayName, password, confirmPassword) {
    const trimUser = (username || '').trim();
    if (trimUser.length === 0) {
      return Promise.resolve({ ok: false, error: 'Username cannot be empty.' });
    }
    if (trimUser.length > 30) {
      return Promise.resolve({ ok: false, error: 'Username must be 30 characters or fewer.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimUser)) {
      return Promise.resolve({ ok: false, error: 'Username may only contain letters, numbers, and underscores.' });
    }
    if (!password || password.length < 4) {
      return Promise.resolve({ ok: false, error: 'Password must be at least 4 characters.' });
    }
    if (password !== confirmPassword) {
      return Promise.resolve({ ok: false, error: 'Passwords do not match.' });
    }

    // displayName is optional — fall back to username if blank
    let trimDisplay = (displayName || '').trim().slice(0, 50);
    if (trimDisplay.length === 0) trimDisplay = trimUser;

    const users = App.Storage.get('pd_users', []);
    const lowerUser = trimUser.toLowerCase();
    for (let i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === lowerUser) {
        return Promise.resolve({ ok: false, error: 'Username already taken.' });
      }
    }

    return hashPassword(password).then(function (hash) {
      const newUser = {
        id: generateId(),
        username: trimUser,
        displayName: trimDisplay,
        passwordHash: hash,
        createdAt: Date.now()
      };
      users.push(newUser);
      App.Storage.set('pd_users', users);
      return { ok: true, user: newUser };
    });
  },

  /* Login. Returns a Promise resolving to {ok, error} */
  login: function (username, password) {
    const trimUser = (username || '').trim();
    if (trimUser.length === 0) {
      return Promise.resolve({ ok: false, error: 'Please enter your username.' });
    }
    if (!password) {
      return Promise.resolve({ ok: false, error: 'Please enter your password.' });
    }

    const users = App.Storage.get('pd_users', []);
    const lowerUser = trimUser.toLowerCase();
    let found = null;
    for (let i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === lowerUser) {
        found = users[i];
        break;
      }
    }
    if (!found) {
      return Promise.resolve({ ok: false, error: 'Username not found.' });
    }

    return hashPassword(password).then(function (hash) {
      if (hash !== found.passwordHash) {
        return { ok: false, error: 'Incorrect password.' };
      }
      const session = {
        user: { id: found.id, username: found.username, displayName: found.displayName || found.username },
        loginAt: Date.now(),
        expiresAt: Date.now() + SESSION_TIMEOUT_MS
      };
      App.Storage.set('pd_session', session);
      App.Auth._session = session;
      return { ok: true, user: found };
    });
  },

  /* Logout */
  logout: function () {
    App.Storage.remove('pd_session');
    this._session = null;
  }
};

/* ============================================================
   App.Theme — light/dark toggle (per-user when logged in)
   ============================================================ */
App.Theme = {
  _current: 'light',

  _themeKey: function () {
    const user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'theme') : 'pd_theme';
  },

  init: function () {
    const saved = App.Storage.get(this._themeKey(), null);
    if (saved === 'light' || saved === 'dark') {
      this._current = saved;
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._current = prefersDark ? 'dark' : 'light';
    }
    this._apply(this._current);
  },

  toggle: function () {
    this._current = this._current === 'light' ? 'dark' : 'light';
    this._apply(this._current);
    App.Storage.set(this._themeKey(), this._current);
  },

  _apply: function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('.theme-icon');
    if (theme === 'dark') {
      if (icon) icon.textContent = '☀️';
      btn.setAttribute('aria-label', 'Switch to light mode');
      btn.setAttribute('title', 'Switch to light mode');
    } else {
      if (icon) icon.textContent = '🌙';
      btn.setAttribute('aria-label', 'Switch to dark mode');
      btn.setAttribute('title', 'Switch to dark mode');
    }
  }
};

/* ============================================================
   App.Greeting — live clock, date, greeting phrase
   Logged out: "Good Morning/Afternoon/Evening, Welcome"
   Logged in:  "Welcome {username}, Good Morning/Afternoon/Evening"
   ============================================================ */
App.Greeting = {
  _intervalId: null,

  init: function () {
    this._renderDate();
    this._renderGreeting();
    this._tick();
    const self = this;
    this._intervalId = setInterval(function () {
      self._tick();
    }, 1000);
  },

  _tick: function () {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = hh + ':' + mm + ':' + ss;
  },

  _renderDate: function () {
    const now = new Date();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    const dateStr = weekdays[now.getDay()] + ', ' + now.getDate() + ' ' +
                  months[now.getMonth()] + ' ' + now.getFullYear();
    const el = document.getElementById('date-display');
    if (el) el.textContent = dateStr;
  },

  _getGreetingPhrase: function (hour) {
    if (hour >= 5 && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  _renderGreeting: function () {
    const hour = new Date().getHours();
    const phrase = this._getGreetingPhrase(hour);
    const user = App.Auth.currentUser();
    let text;
    if (user) {
      const name = user.displayName || user.username;
      text = 'Welcome ' + name + ', ' + phrase;
    } else {
      text = phrase + ', Welcome';
    }
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = text;
  }
};

/* ============================================================
   App.AuthUI — modal popup for sign-up / sign-in, header chip
   ============================================================ */
App.AuthUI = {
  init: function () {
    this._renderHeader();
    this._bindModal();
    this._bindForms();
  },

  /* Render the sign-in button or user chip in the header */
  _renderHeader: function () {
    const container = document.getElementById('auth-header');
    if (!container) return;
    const user = App.Auth.currentUser();
    if (user) {
      container.innerHTML =
        '<div class="user-chip">' +
          '<span class="user-chip-name" aria-label="Logged in as ' + user.username + '">👤 ' + user.username + '</span>' +
          '<button id="logout-btn" class="btn btn-secondary btn-sm" aria-label="Sign out">Sign Out</button>' +
        '</div>';
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          App.AuthUI._onLogout();
        });
      }
    } else {
      container.innerHTML =
        '<button id="signin-open-btn" class="btn btn-primary btn-sm" aria-label="Sign in or create account">Sign In</button>';
      const openBtn = document.getElementById('signin-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          App.AuthUI.openModal('signin');
        });
      }
    }
  },

  /* Open the modal, optionally switching to a tab */
  openModal: function (tab) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (tab === 'signin') {
      this._switchTab('signin');
    } else {
      this._switchTab('signup');
    }
    const firstInput = modal.querySelector('input');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
  },

  closeModal: function () {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    clearMsg('signup-error');
    clearMsg('signin-error');
    const sf = document.getElementById('signup-form');
    const lf = document.getElementById('signin-form');
    if (sf) sf.reset();
    if (lf) lf.reset();
  },

  _switchTab: function (tab) {
    const tabSignup = document.getElementById('tab-signup');
    const tabSignin = document.getElementById('tab-signin');
    const panelSignup = document.getElementById('panel-signup');
    const panelSignin = document.getElementById('panel-signin');
    if (tab === 'signin') {
      tabSignin.classList.add('active');
      tabSignin.setAttribute('aria-selected', 'true');
      tabSignup.classList.remove('active');
      tabSignup.setAttribute('aria-selected', 'false');
      panelSignin.classList.remove('hidden');
      panelSignup.classList.add('hidden');
    } else {
      tabSignup.classList.add('active');
      tabSignup.setAttribute('aria-selected', 'true');
      tabSignin.classList.remove('active');
      tabSignin.setAttribute('aria-selected', 'false');
      panelSignup.classList.remove('hidden');
      panelSignin.classList.add('hidden');
    }
  },

  _bindModal: function () {
    const closeBtn = document.getElementById('auth-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { App.AuthUI.closeModal(); });
    }
    const overlay = document.getElementById('auth-modal');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) App.AuthUI.closeModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') App.AuthUI.closeModal();
    });
    const tabSignup = document.getElementById('tab-signup');
    const tabSignin = document.getElementById('tab-signin');
    if (tabSignup) tabSignup.addEventListener('click', function () { App.AuthUI._switchTab('signup'); });
    if (tabSignin) tabSignin.addEventListener('click', function () { App.AuthUI._switchTab('signin'); });
  },

  _bindForms: function () {
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', function (e) {
        e.preventDefault();
        App.AuthUI._onSignup();
      });
    }
    const signinForm = document.getElementById('signin-form');
    if (signinForm) {
      signinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        App.AuthUI._onSignin();
      });
    }
  },

  _onSignup: function () {
    const username = document.getElementById('signup-username').value;
    const displayName = document.getElementById('signup-displayname').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const submitBtn = document.getElementById('signup-submit');
    if (submitBtn) submitBtn.disabled = true;

    App.Auth.register(username, displayName, password, confirm).then(function (result) {
      if (submitBtn) submitBtn.disabled = false;
      if (!result.ok) {
        showError('signup-error', result.error, 'error');
        return;
      }
      App.Auth.login(username, password).then(function (loginResult) {
        if (loginResult.ok) {
          App.AuthUI._onAuthSuccess();
        }
      });
    });
  },

  _onSignin: function () {
    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;
    const submitBtn = document.getElementById('signin-submit');
    if (submitBtn) submitBtn.disabled = true;

    App.Auth.login(username, password).then(function (result) {
      if (submitBtn) submitBtn.disabled = false;
      if (!result.ok) {
        showError('signin-error', result.error, 'error');
        return;
      }
      App.AuthUI._onAuthSuccess();
    });
  },

  /* Called after successful login or registration */
  _onAuthSuccess: function () {
    App.AuthUI.closeModal();
    App.AuthUI._renderHeader();
    App.Greeting._renderGreeting();
    // Reload per-user data
    App.Theme.init();
    App.Timer.init();
    App.TimerConfig._loadSaved();
    App.Todo._reload();
    App.Links._reload();
  },

  _onLogout: function () {
    App.Auth.logout();
    App.AuthUI._renderHeader();
    App.Greeting._renderGreeting();
    // Reload with guest (global) data
    App.Theme.init();
    App.Timer.init();
    App.TimerConfig._loadSaved();
    App.Todo._reload();
    App.Links._reload();
  }
};

/* ============================================================
   App.Timer — Pomodoro countdown
   ============================================================ */
App.Timer = {
  _intervalId: null,
  _remaining: 0,
  _configured: 0,
  _isRunning: false,

  _durationKey: function () {
    const user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'pomoDuration') : 'pd_pomoDuration';
  },

  init: function () {
    const savedMinutes = App.Storage.get(this._durationKey(), 25);
    const minutes = (typeof savedMinutes === 'number' && savedMinutes >= 1 && savedMinutes <= 120)
      ? savedMinutes : 25;
    this._configured = minutes * 60;
    this._remaining = this._configured;
    this._isRunning = false;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    this._render();
    const completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
  },

  start: function () {
    if (this._isRunning) return;
    if (this._remaining <= 0) {
      this._remaining = this._configured;
    }
    this._isRunning = true;
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = true;
    const completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
    const self = this;
    this._intervalId = setInterval(function () {
      self._tick();
    }, 1000);
  },

  stop: function () {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._isRunning = false;
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = false;
  },

  reset: function () {
    this.stop();
    this._remaining = this._configured;
    this._render();
    const completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
  },

  _tick: function () {
    this._remaining -= 1;
    if (this._remaining <= 0) {
      this._remaining = 0;
      this._render();
      this._onComplete();
    } else {
      this._render();
    }
  },

  _onComplete: function () {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._isRunning = false;
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = false;
    const completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.remove('hidden');
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1.2);
      }
    } catch (e) {
      // Audio unavailable — visual message still shown
    }
  },

  _render: function () {
    const displayEl = document.getElementById('timer-display');
    if (displayEl) displayEl.textContent = this._formatTime(this._remaining);
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = this._isRunning;
  },

  _formatTime: function (secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
};

/* ============================================================
   App.TimerConfig — duration configuration
   ============================================================ */
App.TimerConfig = {
  init: function () {
    this._loadSaved();
    const applyBtn = document.getElementById('duration-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', this._onApply.bind(this));
    }
  },

  _loadSaved: function () {
    const savedMinutes = App.Storage.get(App.Timer._durationKey(), 25);
    const minutes = (typeof savedMinutes === 'number' && savedMinutes >= 1 && savedMinutes <= 120)
      ? savedMinutes : 25;
    const input = document.getElementById('duration-input');
    if (input) input.value = minutes;
  },

  _validate: function (value) {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 120) {
      return { valid: false, message: 'Please enter a whole number between 1 and 120.' };
    }
    return { valid: true, minutes: num };
  },

  _onApply: function (e) {
    e.preventDefault();
    const input = document.getElementById('duration-input');
    if (!input) return;
    const result = this._validate(input.value);
    if (!result.valid) {
      showError('duration-error', result.message, 'error');
      return;
    }
    clearMsg('duration-error');
    App.Timer.stop();
    App.Timer._configured = result.minutes * 60;
    App.Timer._remaining = App.Timer._configured;
    App.Timer._render();
    const completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
    App.Storage.set(App.Timer._durationKey(), result.minutes);
  }
};

/* ============================================================
   App.Todo — to-do list CRUD and sort
   ============================================================ */
App.Todo = {
  _tasks: [],
  _sortMode: 'default',

  _tasksKey: function () {
    const user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'tasks') : 'pd_tasks';
  },

  init: function () {
    this._load();
    this._render();

    const addBtn = document.getElementById('task-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        const input = document.getElementById('task-input');
        if (input) App.Todo.addTask(input.value);
      });
    }

    const taskInput = document.getElementById('task-input');
    if (taskInput) {
      taskInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          App.Todo.addTask(taskInput.value);
        }
      });
      taskInput.addEventListener('input', function () {
        clearMsg('task-error');
      });
    }

    const sortSelect = document.getElementById('task-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        App.Todo.setSort(sortSelect.value);
      });
    }

    const taskList = document.getElementById('task-list');
    if (taskList) {
      taskList.addEventListener('change', this._handleEvent.bind(this));
      taskList.addEventListener('click', this._handleEvent.bind(this));
      taskList.addEventListener('keydown', this._handleEvent.bind(this));
    }
  },

  _reload: function () {
    this._sortMode = 'default';
    const sortSelect = document.getElementById('task-sort');
    if (sortSelect) sortSelect.value = 'default';
    this._load();
    this._render();
  },

  _load: function () {
    const loaded = App.Storage.get(this._tasksKey(), null);
    if (Array.isArray(loaded)) {
      this._tasks = loaded;
    } else if (loaded !== null) {
      showError('task-error', 'Could not load saved tasks.', 'error');
      this._tasks = [];
    } else {
      this._tasks = [];
    }
  },

  addTask: function (description) {
    const trimmed = (description || '').trim();
    if (trimmed.length === 0) {
      showError('task-error', 'Task description cannot be empty.', 'error');
      return;
    }
    const lowerTrimmed = trimmed.toLowerCase();
    for (let i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].description.toLowerCase() === lowerTrimmed) {
        showError('task-error', 'A task with this description already exists.', 'warning');
        return;
      }
    }
    const task = {
      id: generateId(),
      description: trimmed,
      completed: false,
      createdAt: Date.now()
    };
    this._tasks.push(task);
    const input = document.getElementById('task-input');
    if (input) input.value = '';
    clearMsg('task-error');
    this._persist();
    this._render();
  },

  editTask: function (id, newDescription) {
    const trimmed = (newDescription || '').trim();
    if (trimmed.length === 0) {
      showError('task-error', 'Task description cannot be empty.', 'error');
      return false;
    }
    if (trimmed.length > 200) {
      showError('task-error', 'Task description must be 200 characters or fewer.', 'error');
      return false;
    }
    for (let i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        this._tasks[i].description = trimmed;
        this._persist();
        this._render();
        return true;
      }
    }
    return false;
  },

  toggleComplete: function (id) {
    for (let i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        this._tasks[i].completed = !this._tasks[i].completed;
        this._persist();
        this._render();
        return;
      }
    }
  },

  deleteTask: function (id) {
    this._tasks = this._tasks.filter(function (t) { return t.id !== id; });
    this._persist();
    this._render();
  },

  setSort: function (mode) {
    this._sortMode = mode;
    this._render();
  },

  _getSorted: function () {
    const copy = this._tasks.slice();
    if (this._sortMode === 'az') {
      copy.sort(function (a, b) {
        return a.description.toLowerCase().localeCompare(b.description.toLowerCase());
      });
    } else if (this._sortMode === 'za') {
      copy.sort(function (a, b) {
        return b.description.toLowerCase().localeCompare(a.description.toLowerCase());
      });
    } else if (this._sortMode === 'completed-last') {
      copy.sort(function (a, b) {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
      });
    }
    // 'default' — insertion order (already preserved)
    return copy;
  },

  _persist: function () {
    const result = App.Storage.set(this._tasksKey(), this._tasks);
    if (!result.ok) {
      showError('task-error', 'Could not save changes. Storage may be full.', 'error');
    }
  },

  _render: function () {
    const list = document.getElementById('task-list');
    if (!list) return;
    const sorted = this._getSorted();
    if (sorted.length === 0) {
      list.innerHTML = '';
      return;
    }
    let html = '';
    for (let i = 0; i < sorted.length; i++) {
      html += this._renderItem(sorted[i]);
    }
    list.innerHTML = html;
  },

  _renderItem: function (task) {
    const escapedDesc = task.description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const completedClass = task.completed ? ' completed' : '';
    const checkedAttr = task.completed ? ' checked' : '';
    return '<li class="task-item' + completedClass + '" data-id="' + task.id + '">' +
      '<input type="checkbox" class="task-checkbox" aria-label="Mark task complete"' + checkedAttr + ' />' +
      '<span class="task-description">' + escapedDesc + '</span>' +
      '<div class="task-actions">' +
        '<button class="btn btn-secondary btn-icon task-edit-btn" aria-label="Edit task" title="Edit task">✏️</button>' +
        '<button class="btn btn-secondary btn-icon task-delete-btn" aria-label="Delete task" title="Delete task">🗑️</button>' +
      '</div>' +
    '</li>';
  },

  _handleEvent: function (e) {
    const target = e.target;
    const li = target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;

    if (target.classList.contains('task-checkbox') && e.type === 'change') {
      App.Todo.toggleComplete(id);
      return;
    }

    if (target.closest('.task-delete-btn') && e.type === 'click') {
      App.Todo.deleteTask(id);
      return;
    }

    if (target.closest('.task-edit-btn') && e.type === 'click') {
      const descSpan = li.querySelector('.task-description');
      if (!descSpan) return;
      const currentText = descSpan.textContent;
      const actionsDiv = li.querySelector('.task-actions');

      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'task-edit-input';
      editInput.value = currentText;
      editInput.maxLength = 200;
      editInput.setAttribute('aria-label', 'Edit task description');
      li.replaceChild(editInput, descSpan);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary btn-icon task-confirm-btn';
      confirmBtn.setAttribute('aria-label', 'Confirm edit');
      confirmBtn.title = 'Confirm';
      confirmBtn.textContent = '✔';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-icon task-cancel-btn';
      cancelBtn.setAttribute('aria-label', 'Cancel edit');
      cancelBtn.title = 'Cancel';
      cancelBtn.textContent = '✖';

      actionsDiv.innerHTML = '';
      actionsDiv.appendChild(confirmBtn);
      actionsDiv.appendChild(cancelBtn);

      editInput.focus();
      editInput.select();
      return;
    }

    if (target.closest('.task-confirm-btn') && e.type === 'click') {
      const editInputEl = li.querySelector('.task-edit-input');
      if (editInputEl) {
        App.Todo.editTask(id, editInputEl.value);
      }
      return;
    }

    if (target.closest('.task-cancel-btn') && e.type === 'click') {
      App.Todo._render();
      return;
    }

    if (e.type === 'keydown' && e.key === 'Escape') {
      const editEl = li.querySelector('.task-edit-input');
      if (editEl) {
        App.Todo._render();
      }
      return;
    }

    if (e.type === 'keydown' && e.key === 'Enter') {
      const editInputEnter = li.querySelector('.task-edit-input');
      if (editInputEnter) {
        e.preventDefault();
        App.Todo.editTask(id, editInputEnter.value);
      }
    }
  }
};

/* ============================================================
   App.Links — quick links panel
   ============================================================ */
App.Links = {
  _links: [],

  _linksKey: function () {
    const user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'links') : 'pd_links';
  },

  init: function () {
    this._load();
    this._render();

    const addBtn = document.getElementById('link-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        const labelInput = document.getElementById('link-label-input');
        const urlInput = document.getElementById('link-url-input');
        const label = labelInput ? labelInput.value : '';
        const url = urlInput ? urlInput.value : '';
        App.Links.addLink(label, url);
      });
    }

    const labelInput = document.getElementById('link-label-input');
    const urlInput = document.getElementById('link-url-input');
    if (labelInput) labelInput.addEventListener('input', function () { clearMsg('link-error'); });
    if (urlInput) urlInput.addEventListener('input', function () { clearMsg('link-error'); });

    const linksList = document.getElementById('links-list');
    if (linksList) {
      linksList.addEventListener('click', this._handleEvent.bind(this));
    }
  },

  /* Reload links from storage (called on login/logout) */
  _reload: function () {
    this._load();
    this._render();
  },

  _load: function () {
    const loaded = App.Storage.get(this._linksKey(), null);
    this._links = Array.isArray(loaded) ? loaded : [];
  },

  _validateUrl: function (url) {
    try {
      const parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
             parsed.hostname.length > 0;
    } catch (e) {
      return false;
    }
  },

  addLink: function (label, url) {
    const trimmedLabel = (label || '').trim();
    const trimmedUrl = (url || '').trim();

    if (trimmedLabel.length === 0) {
      showError('link-error', 'Please enter a label for the link.', 'error');
      return;
    }
    if (trimmedLabel.length > 100) {
      showError('link-error', 'Label must be 100 characters or fewer.', 'error');
      return;
    }
    if (!this._validateUrl(trimmedUrl)) {
      showError('link-error', 'URL must start with http:// or https:// and include a domain.', 'error');
      return;
    }
    for (let i = 0; i < this._links.length; i++) {
      if (this._links[i].url === trimmedUrl) {
        showError('link-error', 'This URL is already in your links.', 'error');
        return;
      }
    }
    if (this._links.length >= 50) {
      showError('link-error', 'You have reached the maximum of 50 links.', 'error');
      return;
    }

    const link = {
      id: generateId(),
      label: trimmedLabel,
      url: trimmedUrl
    };
    this._links.push(link);

    const labelInput = document.getElementById('link-label-input');
    const urlInput = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput) urlInput.value = '';
    clearMsg('link-error');

    this._persist();
    this._render();
  },

  deleteLink: function (id) {
    this._links = this._links.filter(function (l) { return l.id !== id; });
    this._persist();
    this._render();
  },

  _persist: function () {
    const result = App.Storage.set(this._linksKey(), this._links);
    if (!result.ok) {
      showError('link-error', 'Could not save changes. Storage may be full.', 'error');
    }
  },

  _render: function () {
    const list = document.getElementById('links-list');
    const emptyMsg = document.getElementById('links-empty');
    if (!list) return;

    if (this._links.length === 0) {
      list.innerHTML = '';
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');
    let html = '';
    for (let i = 0; i < this._links.length; i++) {
      html += this._renderItem(this._links[i]);
    }
    list.innerHTML = html;
  },

  _renderItem: function (link) {
    const escapedLabel = link.label
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const escapedUrl = link.url
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return '<li class="link-item" data-id="' + link.id + '">' +
      '<a class="link-anchor" href="' + escapedUrl + '" target="_blank" rel="noopener noreferrer" ' +
        'aria-label="Open ' + escapedLabel + ' in new tab">' + escapedLabel + '</a>' +
      '<button class="btn btn-secondary btn-icon link-delete-btn" aria-label="Delete link" title="Delete link">🗑️</button>' +
    '</li>';
  },

  _handleEvent: function (e) {
    const target = e.target;
    const li = target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (target.closest('.link-delete-btn')) {
      App.Links.deleteLink(id);
    }
  }
};

/* ============================================================
   App.Disclaimer — one-time disclaimer popup on first visit
   ============================================================ */
App.Disclaimer = {
  init: function () {
    const seen = App.Storage.get('pd_disclaimer_seen', false);
    if (!seen) {
      this._show();
    }
    const acceptBtn = document.getElementById('disclaimer-accept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        App.Disclaimer._dismiss();
      });
    }
  },

  _show: function () {
    const modal = document.getElementById('disclaimer-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const btn = document.getElementById('disclaimer-accept');
    if (btn) setTimeout(function () { btn.focus(); }, 50);
  },

  _dismiss: function () {
    App.Storage.set('pd_disclaimer_seen', true);
    const modal = document.getElementById('disclaimer-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
};

/* ============================================================
   App.init — bootstrap all modules
   ============================================================ */
App.init = function () {
  App.Auth.loadSession();
  App.Theme.init();
  App.Greeting.init();
  App.Disclaimer.init();
  App.AuthUI.init();
  App.Timer.init();
  App.TimerConfig.init();
  App.Todo.init();
  App.Links.init();

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      App.Theme.toggle();
    });
  }

  // Timer controls
  const timerStart = document.getElementById('timer-start');
  const timerStop = document.getElementById('timer-stop');
  const timerReset = document.getElementById('timer-reset');
  if (timerStart) timerStart.addEventListener('click', function () { App.Timer.start(); });
  if (timerStop) timerStop.addEventListener('click', function () { App.Timer.stop(); });
  if (timerReset) timerReset.addEventListener('click', function () { App.Timer.reset(); });
};

document.addEventListener('DOMContentLoaded', App.init);
