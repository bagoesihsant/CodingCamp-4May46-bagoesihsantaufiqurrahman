/* ============================================================
   Personal Dashboard — js/app.js
   All logic lives here. No external dependencies.
   ============================================================ */

'use strict';

/* ============================================================
   Constants
   ============================================================ */
var SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  var encoder = new TextEncoder();
  var data = encoder.encode(password);
  return crypto.subtle.digest('SHA-256', data).then(function (hashBuffer) {
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}

/* ============================================================
   Utility: Error message display
   ============================================================ */
function showError(elementId, message, type) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'error-msg ' + (type === 'warning' ? 'is-warning' : 'is-error');
  clearTimeout(el._clearTimer);
  el._clearTimer = setTimeout(function () {
    clearMsg(elementId);
  }, 5000);
}

function clearMsg(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.className = 'error-msg';
}

/* ============================================================
   App Namespace
   ============================================================ */
var App = {};

/* ============================================================
   App.Storage — localStorage wrapper
   ============================================================ */
App.Storage = {
  get: function (key, defaultValue) {
    try {
      var raw = localStorage.getItem(key);
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
    var session = App.Storage.get('pd_session', null);
    if (!session) { this._session = null; return; }
    if (Date.now() > session.expiresAt) {
      App.Storage.remove('pd_session');
      this._session = null;
      return;
    }
    this._session = session;
  },

  /* Register a new user. Returns a Promise resolving to {ok, error} */
  register: function (username, password, confirmPassword) {
    var trimUser = (username || '').trim();
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

    var users = App.Storage.get('pd_users', []);
    var lowerUser = trimUser.toLowerCase();
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === lowerUser) {
        return Promise.resolve({ ok: false, error: 'Username already taken.' });
      }
    }

    return hashPassword(password).then(function (hash) {
      var newUser = {
        id: generateId(),
        username: trimUser,
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
    var trimUser = (username || '').trim();
    if (trimUser.length === 0) {
      return Promise.resolve({ ok: false, error: 'Please enter your username.' });
    }
    if (!password) {
      return Promise.resolve({ ok: false, error: 'Please enter your password.' });
    }

    var users = App.Storage.get('pd_users', []);
    var lowerUser = trimUser.toLowerCase();
    var found = null;
    for (var i = 0; i < users.length; i++) {
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
      var session = {
        user: { id: found.id, username: found.username },
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
    var user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'theme') : 'pd_theme';
  },

  init: function () {
    var saved = App.Storage.get(this._themeKey(), null);
    if (saved === 'light' || saved === 'dark') {
      this._current = saved;
    } else {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var icon = btn.querySelector('.theme-icon');
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
    var self = this;
    this._intervalId = setInterval(function () {
      self._tick();
    }, 1000);
  },

  _tick: function () {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    var clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = hh + ':' + mm + ':' + ss;
  },

  _renderDate: function () {
    var now = new Date();
    var weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    var dateStr = weekdays[now.getDay()] + ', ' + now.getDate() + ' ' +
                  months[now.getMonth()] + ' ' + now.getFullYear();
    var el = document.getElementById('date-display');
    if (el) el.textContent = dateStr;
  },

  _getGreetingPhrase: function (hour) {
    if (hour >= 5 && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 17) return 'Good Afternoon';
    return 'Good Evening';
  },

  _renderGreeting: function () {
    var hour = new Date().getHours();
    var phrase = this._getGreetingPhrase(hour);
    var user = App.Auth.currentUser();
    var text;
    if (user) {
      text = 'Welcome ' + user.username + ', ' + phrase;
    } else {
      text = phrase + ', Welcome';
    }
    var el = document.getElementById('greeting-text');
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
    var container = document.getElementById('auth-header');
    if (!container) return;
    var user = App.Auth.currentUser();
    if (user) {
      container.innerHTML =
        '<div class="user-chip">' +
          '<span class="user-chip-name" aria-label="Logged in as ' + user.username + '">👤 ' + user.username + '</span>' +
          '<button id="logout-btn" class="btn btn-secondary btn-sm" aria-label="Sign out">Sign Out</button>' +
        '</div>';
      var logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          App.AuthUI._onLogout();
        });
      }
    } else {
      container.innerHTML =
        '<button id="signin-open-btn" class="btn btn-primary btn-sm" aria-label="Sign in or create account">Sign In</button>';
      var openBtn = document.getElementById('signin-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          App.AuthUI.openModal('signin');
        });
      }
    }
  },

  /* Open the modal, optionally switching to a tab */
  openModal: function (tab) {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (tab === 'signin') {
      this._switchTab('signin');
    } else {
      this._switchTab('signup');
    }
    // Focus first input
    var firstInput = modal.querySelector('input');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
  },

  closeModal: function () {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    clearMsg('signup-error');
    clearMsg('signin-error');
    // Reset forms
    var sf = document.getElementById('signup-form');
    var lf = document.getElementById('signin-form');
    if (sf) sf.reset();
    if (lf) lf.reset();
  },

  _switchTab: function (tab) {
    var tabSignup = document.getElementById('tab-signup');
    var tabSignin = document.getElementById('tab-signin');
    var panelSignup = document.getElementById('panel-signup');
    var panelSignin = document.getElementById('panel-signin');
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
    var closeBtn = document.getElementById('auth-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { App.AuthUI.closeModal(); });
    }
    var overlay = document.getElementById('auth-modal');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) App.AuthUI.closeModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') App.AuthUI.closeModal();
    });
    var tabSignup = document.getElementById('tab-signup');
    var tabSignin = document.getElementById('tab-signin');
    if (tabSignup) tabSignup.addEventListener('click', function () { App.AuthUI._switchTab('signup'); });
    if (tabSignin) tabSignin.addEventListener('click', function () { App.AuthUI._switchTab('signin'); });
  },

  _bindForms: function () {
    var signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', function (e) {
        e.preventDefault();
        App.AuthUI._onSignup();
      });
    }
    var signinForm = document.getElementById('signin-form');
    if (signinForm) {
      signinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        App.AuthUI._onSignin();
      });
    }
  },

  _onSignup: function () {
    var username = document.getElementById('signup-username').value;
    var password = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;
    var submitBtn = document.getElementById('signup-submit');
    if (submitBtn) submitBtn.disabled = true;

    App.Auth.register(username, password, confirm).then(function (result) {
      if (submitBtn) submitBtn.disabled = false;
      if (!result.ok) {
        showError('signup-error', result.error, 'error');
        return;
      }
      // Auto-login after registration
      App.Auth.login(username, password).then(function (loginResult) {
        if (loginResult.ok) {
          App.AuthUI._onAuthSuccess();
        }
      });
    });
  },

  _onSignin: function () {
    var username = document.getElementById('signin-username').value;
    var password = document.getElementById('signin-password').value;
    var submitBtn = document.getElementById('signin-submit');
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
    var user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'pomoDuration') : 'pd_pomoDuration';
  },

  init: function () {
    var savedMinutes = App.Storage.get(this._durationKey(), 25);
    var minutes = (typeof savedMinutes === 'number' && savedMinutes >= 1 && savedMinutes <= 120)
      ? savedMinutes : 25;
    this._configured = minutes * 60;
    this._remaining = this._configured;
    this._isRunning = false;
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    this._render();
    var completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
  },

  start: function () {
    if (this._isRunning) return;
    // If timer reached 0, reset first
    if (this._remaining <= 0) {
      this._remaining = this._configured;
    }
    this._isRunning = true;
    var startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = true;
    var completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.add('hidden');
    var self = this;
    this._intervalId = setInterval(function () {
      self._tick();
    }, 1000);
  },

  stop: function () {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._isRunning = false;
    var startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = false;
  },

  reset: function () {
    this.stop();
    this._remaining = this._configured;
    this._render();
    var completeMsg = document.getElementById('timer-complete-msg');
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
    var startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = false;
    var completeMsg = document.getElementById('timer-complete-msg');
    if (completeMsg) completeMsg.classList.remove('hidden');
    // Audible beep via Web Audio API
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        var ctx = new AudioCtx();
        var oscillator = ctx.createOscillator();
        var gainNode = ctx.createGain();
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
    var displayEl = document.getElementById('timer-display');
    if (displayEl) displayEl.textContent = this._formatTime(this._remaining);
    var startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = this._isRunning;
  },

  _formatTime: function (secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
};

/* ============================================================
   App.TimerConfig — duration configuration
   ============================================================ */
App.TimerConfig = {
  init: function () {
    this._loadSaved();
    var applyBtn = document.getElementById('duration-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', this._onApply.bind(this));
    }
  },

  _loadSaved: function () {
    var savedMinutes = App.Storage.get(App.Timer._durationKey(), 25);
    var minutes = (typeof savedMinutes === 'number' && savedMinutes >= 1 && savedMinutes <= 120)
      ? savedMinutes : 25;
    var input = document.getElementById('duration-input');
    if (input) input.value = minutes;
  },

  _validate: function (value) {
    var num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 120) {
      return { valid: false, message: 'Please enter a whole number between 1 and 120.' };
    }
    return { valid: true, minutes: num };
  },

  _onApply: function (e) {
    e.preventDefault();
    var input = document.getElementById('duration-input');
    if (!input) return;
    var result = this._validate(input.value);
    if (!result.valid) {
      showError('duration-error', result.message, 'error');
      return;
    }
    clearMsg('duration-error');
    App.Timer.stop();
    App.Timer._configured = result.minutes * 60;
    App.Timer._remaining = App.Timer._configured;
    App.Timer._render();
    var completeMsg = document.getElementById('timer-complete-msg');
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
    var user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'tasks') : 'pd_tasks';
  },

  init: function () {
    this._load();
    this._render();

    // Attach add button listener
    var addBtn = document.getElementById('task-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var input = document.getElementById('task-input');
        if (input) App.Todo.addTask(input.value);
      });
    }

    // Allow Enter key in task input
    var taskInput = document.getElementById('task-input');
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

    // Sort control
    var sortSelect = document.getElementById('task-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        App.Todo.setSort(sortSelect.value);
      });
    }

    // Event delegation on task list
    var taskList = document.getElementById('task-list');
    if (taskList) {
      taskList.addEventListener('change', this._handleEvent.bind(this));
      taskList.addEventListener('click', this._handleEvent.bind(this));
      taskList.addEventListener('keydown', this._handleEvent.bind(this));
    }
  },

  /* Reload tasks from storage (called on login/logout) */
  _reload: function () {
    this._sortMode = 'default';
    var sortSelect = document.getElementById('task-sort');
    if (sortSelect) sortSelect.value = 'default';
    this._load();
    this._render();
  },

  _load: function () {
    var loaded = App.Storage.get(this._tasksKey(), null);
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
    var trimmed = (description || '').trim();
    if (trimmed.length === 0) {
      showError('task-error', 'Task description cannot be empty.', 'error');
      return;
    }
    // Duplicate check (case-insensitive)
    var lowerTrimmed = trimmed.toLowerCase();
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].description.toLowerCase() === lowerTrimmed) {
        showError('task-error', 'A task with this description already exists.', 'warning');
        return;
      }
    }
    var task = {
      id: generateId(),
      description: trimmed,
      completed: false,
      createdAt: Date.now()
    };
    this._tasks.push(task);
    var input = document.getElementById('task-input');
    if (input) input.value = '';
    clearMsg('task-error');
    this._persist();
    this._render();
  },

  editTask: function (id, newDescription) {
    var trimmed = (newDescription || '').trim();
    if (trimmed.length === 0) {
      showError('task-error', 'Task description cannot be empty.', 'error');
      return false;
    }
    if (trimmed.length > 200) {
      showError('task-error', 'Task description must be 200 characters or fewer.', 'error');
      return false;
    }
    for (var i = 0; i < this._tasks.length; i++) {
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
    for (var i = 0; i < this._tasks.length; i++) {
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
    var copy = this._tasks.slice();
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
    var result = App.Storage.set(this._tasksKey(), this._tasks);
    if (!result.ok) {
      showError('task-error', 'Could not save changes. Storage may be full.', 'error');
    }
  },

  _render: function () {
    var list = document.getElementById('task-list');
    if (!list) return;
    var sorted = this._getSorted();
    if (sorted.length === 0) {
      list.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < sorted.length; i++) {
      html += this._renderItem(sorted[i]);
    }
    list.innerHTML = html;
  },

  _renderItem: function (task) {
    var escapedDesc = task.description
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    var completedClass = task.completed ? ' completed' : '';
    var checkedAttr = task.completed ? ' checked' : '';
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
    var target = e.target;
    var li = target.closest('li[data-id]');
    if (!li) return;
    var id = li.dataset.id;

    // Checkbox toggle
    if (target.classList.contains('task-checkbox') && e.type === 'change') {
      App.Todo.toggleComplete(id);
      return;
    }

    // Delete button
    if (target.closest('.task-delete-btn') && e.type === 'click') {
      App.Todo.deleteTask(id);
      return;
    }

    // Edit button — switch to inline edit mode
    if (target.closest('.task-edit-btn') && e.type === 'click') {
      var descSpan = li.querySelector('.task-description');
      if (!descSpan) return;
      var currentText = descSpan.textContent;
      var actionsDiv = li.querySelector('.task-actions');

      // Replace span with input
      var editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'task-edit-input';
      editInput.value = currentText;
      editInput.maxLength = 200;
      editInput.setAttribute('aria-label', 'Edit task description');
      li.replaceChild(editInput, descSpan);

      // Replace actions with confirm/cancel
      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary btn-icon task-confirm-btn';
      confirmBtn.setAttribute('aria-label', 'Confirm edit');
      confirmBtn.title = 'Confirm';
      confirmBtn.textContent = '✔';

      var cancelBtn = document.createElement('button');
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

    // Confirm edit
    if (target.closest('.task-confirm-btn') && e.type === 'click') {
      var editInputEl = li.querySelector('.task-edit-input');
      if (editInputEl) {
        App.Todo.editTask(id, editInputEl.value);
      }
      return;
    }

    // Cancel edit
    if (target.closest('.task-cancel-btn') && e.type === 'click') {
      App.Todo._render();
      return;
    }

    // Escape key cancels edit
    if (e.type === 'keydown' && e.key === 'Escape') {
      var editEl = li.querySelector('.task-edit-input');
      if (editEl) {
        App.Todo._render();
      }
      return;
    }

    // Enter key confirms edit
    if (e.type === 'keydown' && e.key === 'Enter') {
      var editInputEnter = li.querySelector('.task-edit-input');
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
    var user = App.Auth.currentUser();
    return user ? App.Auth.scopedKey(user.id, 'links') : 'pd_links';
  },

  init: function () {
    this._load();
    this._render();

    // Add button
    var addBtn = document.getElementById('link-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var labelInput = document.getElementById('link-label-input');
        var urlInput = document.getElementById('link-url-input');
        var label = labelInput ? labelInput.value : '';
        var url = urlInput ? urlInput.value : '';
        App.Links.addLink(label, url);
      });
    }

    // Clear error on input interaction
    var labelInput = document.getElementById('link-label-input');
    var urlInput = document.getElementById('link-url-input');
    if (labelInput) labelInput.addEventListener('input', function () { clearMsg('link-error'); });
    if (urlInput) urlInput.addEventListener('input', function () { clearMsg('link-error'); });

    // Event delegation on links list
    var linksList = document.getElementById('links-list');
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
    var loaded = App.Storage.get(this._linksKey(), null);
    this._links = Array.isArray(loaded) ? loaded : [];
  },

  _validateUrl: function (url) {
    try {
      var parsed = new URL(url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
             parsed.hostname.length > 0;
    } catch (e) {
      return false;
    }
  },

  addLink: function (label, url) {
    var trimmedLabel = (label || '').trim();
    var trimmedUrl = (url || '').trim();

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
    // Duplicate URL check
    for (var i = 0; i < this._links.length; i++) {
      if (this._links[i].url === trimmedUrl) {
        showError('link-error', 'This URL is already in your links.', 'error');
        return;
      }
    }
    if (this._links.length >= 50) {
      showError('link-error', 'You have reached the maximum of 50 links.', 'error');
      return;
    }

    var link = {
      id: generateId(),
      label: trimmedLabel,
      url: trimmedUrl
    };
    this._links.push(link);

    // Clear inputs
    var labelInput = document.getElementById('link-label-input');
    var urlInput = document.getElementById('link-url-input');
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
    var result = App.Storage.set(this._linksKey(), this._links);
    if (!result.ok) {
      showError('link-error', 'Could not save changes. Storage may be full.', 'error');
    }
  },

  _render: function () {
    var list = document.getElementById('links-list');
    var emptyMsg = document.getElementById('links-empty');
    if (!list) return;

    if (this._links.length === 0) {
      list.innerHTML = '';
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');
    var html = '';
    for (var i = 0; i < this._links.length; i++) {
      html += this._renderItem(this._links[i]);
    }
    list.innerHTML = html;
  },

  _renderItem: function (link) {
    var escapedLabel = link.label
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    var escapedUrl = link.url
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
    var target = e.target;
    var li = target.closest('li[data-id]');
    if (!li) return;
    var id = li.dataset.id;
    if (target.closest('.link-delete-btn')) {
      App.Links.deleteLink(id);
    }
  }
};

/* ============================================================
   App.init — bootstrap all modules
   ============================================================ */
App.init = function () {
  App.Auth.loadSession();
  App.Theme.init();
  App.Greeting.init();
  App.AuthUI.init();
  App.Timer.init();
  App.TimerConfig.init();
  App.Todo.init();
  App.Links.init();

  // Theme toggle
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      App.Theme.toggle();
    });
  }

  // Timer controls
  var timerStart = document.getElementById('timer-start');
  var timerStop = document.getElementById('timer-stop');
  var timerReset = document.getElementById('timer-reset');
  if (timerStart) timerStart.addEventListener('click', function () { App.Timer.start(); });
  if (timerStop) timerStop.addEventListener('click', function () { App.Timer.stop(); });
  if (timerReset) timerReset.addEventListener('click', function () { App.Timer.reset(); });
};

document.addEventListener('DOMContentLoaded', App.init);
