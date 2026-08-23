// store.js — shared localStorage data layer used by index.html and calendar.html
(function (global) {
  const KEYS = {
    todos: "todo_app.todos.v1",
    categories: "todo_app.categories.v1",
    priorities: "todo_app.priorities.v1",
    hideCompleted: "todo_app.hideCompleted.v1",
  };

  const DEFAULT_CATEGORIES = [
    { id: "work", name: "업무", color: "#6366f1" },
    { id: "personal", name: "개인", color: "#22c55e" },
    { id: "etc", name: "기타", color: "#94a3b8" },
  ];

  // Fixed 4-level priority system requested: 중요(gold) / 시급(red) / nice-to-have(sky blue) / BAU(gray)
  const DEFAULT_PRIORITIES = [
    { id: "important", name: "중요", color: "#c9971f" },
    { id: "urgent", name: "시급", color: "#e5484d" },
    { id: "nice", name: "Nice to have", color: "#38bdf8" },
    { id: "bau", name: "BAU", color: "#8a8f9c" },
  ];

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      console.warn("store: failed to read", key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("store: failed to write", key, e);
    }
  }

  const Store = {
    KEYS,

    getCategories() {
      let cats = readJSON(KEYS.categories, null);
      if (!cats || !Array.isArray(cats) || cats.length === 0) {
        cats = DEFAULT_CATEGORIES.slice();
        writeJSON(KEYS.categories, cats);
      }
      return cats;
    },
    saveCategories(cats) {
      writeJSON(KEYS.categories, cats);
    },

    getPriorities() {
      let pr = readJSON(KEYS.priorities, null);
      if (!pr || !Array.isArray(pr) || pr.length === 0) {
        pr = DEFAULT_PRIORITIES.slice();
        writeJSON(KEYS.priorities, pr);
      }
      return pr;
    },
    savePriorities(pr) {
      writeJSON(KEYS.priorities, pr);
    },

    getTodos() {
      return readJSON(KEYS.todos, []);
    },
    saveTodos(todos) {
      writeJSON(KEYS.todos, todos);
    },

    createTodo(overrides) {
      const cats = this.getCategories();
      const prs = this.getPriorities();
      const todos = this.getTodos();
      const maxOrder = todos.reduce((m, t) => Math.max(m, t.order || 0), 0);
      const todo = Object.assign(
        {
          id: uid(),
          detail: "",
          category: cats[0] ? cats[0].id : "",
          priority: prs[1] ? prs[1].id : (prs[0] ? prs[0].id : ""),
          due: isoDate(new Date()),
          completed: false,
          order: maxOrder + 1,
          createdAt: Date.now(),
        },
        overrides || {}
      );
      todos.push(todo);
      this.saveTodos(todos);
      return todo;
    },

    updateTodo(id, patch) {
      const todos = this.getTodos();
      const idx = todos.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      todos[idx] = Object.assign({}, todos[idx], patch);
      this.saveTodos(todos);
      return todos[idx];
    },

    deleteTodo(id) {
      const todos = this.getTodos().filter((t) => t.id !== id);
      this.saveTodos(todos);
    },

    reorder(idsInOrder) {
      const todos = this.getTodos();
      const map = new Map(todos.map((t) => [t.id, t]));
      idsInOrder.forEach((id, i) => {
        const t = map.get(id);
        if (t) t.order = i + 1;
      });
      this.saveTodos(Array.from(map.values()));
    },

    // shared "완료된 항목 숨기기" setting — used by every screen (주간/전체/달력)
    getHideCompleted() {
      return readJSON(KEYS.hideCompleted, false) === true;
    },
    setHideCompleted(value) {
      writeJSON(KEYS.hideCompleted, !!value);
    },
  };

  // ---- date helpers ----
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseISODate(s) {
    if (!s) return null;
    const parts = s.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(d, n) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  }

  // Monday-start week
  function getWeekStart(d) {
    const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = nd.getDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(nd, diff);
  }

  function getWeekRange(d) {
    const start = getWeekStart(d);
    const end = addDays(start, 6);
    return { start, end };
  }

  const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

  function formatMD(d) {
    return d.getMonth() + 1 + "/" + d.getDate();
  }

  // e.g. "8/23(일)" — compact due-date label used inline in the todo card
  function formatMDDow(d) {
    return formatMD(d) + "(" + DOW_KR[d.getDay()] + ")";
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  global.TodoStore = Store;
  global.DateUtil = {
    isoDate,
    parseISODate,
    addDays,
    getWeekStart,
    getWeekRange,
    formatMD,
    formatMDDow,
    isSameDay,
    DOW_KR,
    pad2,
  };
})(window);
