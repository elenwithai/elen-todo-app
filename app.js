// app.js — index.html (weekly todo list) logic
(function () {
  const { getWeekRange, addDays, isoDate, parseISODate, formatMD, formatMDDow, isSameDay, DOW_KR } = DateUtil;

  const qs = new URLSearchParams(location.search);
  let refDate = new Date();
  const qWeek = qs.get("week");
  if (qWeek) {
    const parsed = parseISODate(qWeek);
    if (parsed) refDate = parsed;
  }

  let unscheduledOpen = false;
  let currentListView = "week"; // "week" | "all"

  // ---------- element refs ----------
  const weekLabelEl = document.getElementById("weekLabel");
  const weekListEl = document.getElementById("weekList");
  const unscheduledListEl = document.getElementById("unscheduledList");
  const unscheduledToggle = document.getElementById("unscheduledToggle");
  const unscheduledTitle = document.getElementById("unscheduledTitle");
  const unscheduledCountEl = document.getElementById("unscheduledCount");
  const unscheduledArrow = document.getElementById("unscheduledArrow");
  const weekCountEl = document.getElementById("weekCount");
  const emptyStateEl = document.getElementById("emptyState");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  const weekNavWrap = document.getElementById("weekNavWrap");
  const weekViewSection = document.getElementById("weekViewSection");
  const allViewSection = document.getElementById("allViewSection");
  const allListContainer = document.getElementById("allListContainer");
  const allEmptyState = document.getElementById("allEmptyState");
  const allCountEl = document.getElementById("allCount");
  const hideCompletedChk = document.getElementById("hideCompletedChk");

  // "완료된 항목 숨기기" is a single shared setting used by every screen
  // (주간, 전체, and the calendar tab) — persisted so it stays in sync
  // across pages/reloads.
  hideCompletedChk.checked = TodoStore.getHideCompleted();

  document.getElementById("prevWeekBtn").addEventListener("click", () => {
    refDate = addDays(refDate, -7);
    refresh();
  });
  document.getElementById("nextWeekBtn").addEventListener("click", () => {
    refDate = addDays(refDate, 7);
    refresh();
  });
  document.getElementById("todayBtn").addEventListener("click", () => {
    refDate = new Date();
    refresh();
  });
  unscheduledToggle.addEventListener("click", () => {
    unscheduledOpen = !unscheduledOpen;
    renderUnscheduledVisibility();
  });

  document.querySelectorAll("#listSubTabs .sub-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentListView = tab.dataset.view;
      document.querySelectorAll("#listSubTabs .sub-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isWeek = currentListView === "week";
      weekNavWrap.style.display = isWeek ? "block" : "none";
      weekViewSection.style.display = isWeek ? "block" : "none";
      allViewSection.style.display = isWeek ? "none" : "block";
      refresh();
    });
  });

  hideCompletedChk.addEventListener("change", () => {
    TodoStore.setHideCompleted(hideCompletedChk.checked);
    refresh();
  });

  function refresh() {
    if (currentListView === "week") renderWeekView();
    else renderAllView();
  }

  // ---------- color helpers ----------
  function textColorFor(bgHex) {
    const hex = bgHex.replace("#", "");
    if (hex.length !== 6) return "#ffffff";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#12314a" : "#ffffff";
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // ---------- rendering ----------
  function renderWeekLabel() {
    const { start, end } = getWeekRange(refDate);
    const isCurrent = (() => {
      const nowRange = getWeekRange(new Date());
      return isSameDay(nowRange.start, start);
    })();
    weekLabelEl.querySelector(".main").textContent =
      formatMD(start) + " ~ " + formatMD(end) + (isCurrent ? " (이번 주)" : "");
    const y = start.getFullYear();
    weekLabelEl.querySelector(".sub").textContent = y + "년 " + (start.getMonth() + 1) + "월";
  }

  function buildTagSelect(id, kind, selectedId, options) {
    const sel = document.createElement("select");
    sel.className = "tag-select " + (kind === "cat" ? "cat-select" : "priority-select");
    sel.dataset.todoId = id;
    sel.dataset.field = kind === "cat" ? "category" : "priority";
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.id;
      o.textContent = opt.name;
      if (opt.id === selectedId) o.selected = true;
      sel.appendChild(o);
    });
    const current = options.find((o) => o.id === selectedId) || options[0];
    if (current) {
      if (kind === "cat") {
        sel.style.backgroundColor = current.color + "22";
        sel.style.color = current.color;
      } else {
        sel.style.backgroundColor = current.color;
        sel.style.color = textColorFor(current.color);
      }
    }
    return sel;
  }

  function buildCard(todo, index, categories, priorities, opts) {
    const draggable = !opts || opts.draggable !== false;
    const card = document.createElement("div");
    card.className = "todo-card" + (todo.completed ? " completed" : "");
    card.dataset.id = todo.id;

    const todayIso = isoDate(new Date());
    const isOverdue = !todo.completed && todo.due && todo.due < todayIso;
    if (isOverdue) card.classList.add("overdue");

    if (draggable) {
      const handle = document.createElement("div");
      handle.className = "drag-handle";
      handle.innerHTML = "☰";
      card.appendChild(handle);
    }

    const num = document.createElement("div");
    num.className = "todo-num";
    num.textContent = index + 1;
    card.appendChild(num);

    const check = document.createElement("button");
    check.className = "todo-check" + (todo.completed ? " checked" : "");
    check.innerHTML = todo.completed ? "✓" : "";
    check.setAttribute("aria-label", "완료 체크");
    check.addEventListener("click", () => {
      TodoStore.updateTodo(todo.id, { completed: !todo.completed });
      refresh();
    });
    card.appendChild(check);

    const body = document.createElement("div");
    body.className = "todo-body";

    const tagsRow = document.createElement("div");
    tagsRow.className = "todo-tags-row";

    const tagsLeft = document.createElement("div");
    tagsLeft.className = "todo-tags-left";
    const catSel = buildTagSelect(todo.id, "cat", todo.category, categories);
    const priSel = buildTagSelect(todo.id, "pri", todo.priority, priorities);
    catSel.addEventListener("change", (e) => {
      TodoStore.updateTodo(todo.id, { category: e.target.value });
      refresh();
    });
    priSel.addEventListener("change", (e) => {
      TodoStore.updateTodo(todo.id, { priority: e.target.value });
      refresh();
    });
    tagsLeft.appendChild(catSel);
    tagsLeft.appendChild(priSel);

    // due date + delete now live at the right end of the first line —
    // a real <input type="date"> sits invisibly on top of the compact
    // "8/23(일)" label so tapping it still opens the native date picker.
    const tagsRight = document.createElement("div");
    tagsRight.className = "todo-tags-right";

    const dueWrap = document.createElement("div");
    dueWrap.className = "due-display" + (todo.due ? "" : " is-unset");
    const dueText = document.createElement("span");
    dueText.className = "due-text";
    dueText.textContent = todo.due ? formatMDDow(parseISODate(todo.due)) : "날짜 선택";
    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.className = "due-input-overlay";
    dueInput.value = todo.due || "";
    dueInput.setAttribute("aria-label", "기한 날짜");
    dueInput.addEventListener("change", () => {
      TodoStore.updateTodo(todo.id, { due: dueInput.value });
      refresh();
    });
    dueWrap.appendChild(dueText);
    dueWrap.appendChild(dueInput);

    // Two-tap inline confirm instead of window.confirm(): a native confirm()
    // dialog doesn't reliably show up inside a sandboxed preview iframe, so
    // the first tap arms the button ("삭제?") and the second tap (within a
    // few seconds) actually deletes.
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "✕";
    delBtn.setAttribute("aria-label", "삭제");
    let delConfirmTimer = null;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (delBtn.classList.contains("confirm")) {
        clearTimeout(delConfirmTimer);
        TodoStore.deleteTodo(todo.id);
        refresh();
        return;
      }
      delBtn.classList.add("confirm");
      delBtn.innerHTML = "삭제?";
      delBtn.setAttribute("aria-label", "삭제 확인, 한번 더 누르세요");
      delConfirmTimer = setTimeout(() => {
        delBtn.classList.remove("confirm");
        delBtn.innerHTML = "✕";
        delBtn.setAttribute("aria-label", "삭제");
      }, 2500);
    });

    tagsRight.appendChild(dueWrap);
    tagsRight.appendChild(delBtn);

    tagsRow.appendChild(tagsLeft);
    tagsRow.appendChild(tagsRight);
    body.appendChild(tagsRow);

    const detail = document.createElement("textarea");
    detail.className = "todo-detail";
    detail.placeholder = "상세내용을 입력하세요";
    detail.value = todo.detail || "";
    detail.rows = 1;
    let saveTimer = null;
    detail.addEventListener("input", () => {
      autoResize(detail);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        TodoStore.updateTodo(todo.id, { detail: detail.value });
      }, 250);
    });
    body.appendChild(detail);

    card.appendChild(body);

    requestAnimationFrame(() => autoResize(detail));

    return card;
  }

  function renderList(containerEl, todos, categories, priorities) {
    containerEl.innerHTML = "";
    todos.forEach((todo, i) => {
      containerEl.appendChild(buildCard(todo, i, categories, priorities));
    });
    attachDragReorder(containerEl);
  }

  function renderUnscheduledVisibility() {
    unscheduledArrow.textContent = unscheduledOpen ? "▴" : "▾";
    unscheduledListEl.style.display = unscheduledOpen ? "flex" : "none";
    unscheduledTitle.style.display = unscheduledOpen ? "block" : "none";
  }

  function renderWeekView() {
    renderWeekLabel();
    const categories = TodoStore.getCategories();
    const priorities = TodoStore.getPriorities();
    const all = TodoStore.getTodos();
    const hideCompleted = TodoStore.getHideCompleted();

    const { start, end } = getWeekRange(refDate);
    const startIso = isoDate(start);
    const endIso = isoDate(end);

    const weekTodosAll = all
      .filter((t) => t.due && t.due >= startIso && t.due <= endIso)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const weekTodos = hideCompleted ? weekTodosAll.filter((t) => !t.completed) : weekTodosAll;

    const unscheduledAll = all
      .filter((t) => !t.due)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const unscheduled = hideCompleted ? unscheduledAll.filter((t) => !t.completed) : unscheduledAll;

    renderList(weekListEl, weekTodos, categories, priorities);
    renderList(unscheduledListEl, unscheduled, categories, priorities);

    weekCountEl.textContent = weekTodos.length;
    emptyStateEl.style.display = weekTodos.length === 0 ? "block" : "none";

    if (unscheduled.length > 0) {
      unscheduledToggle.style.display = "flex";
      unscheduledCountEl.textContent = "(" + unscheduled.length + ")";
    } else {
      unscheduledToggle.style.display = "none";
      unscheduledOpen = false;
    }
    renderUnscheduledVisibility();

    // progress always reflects the full (unfiltered) week so hiding
    // completed items doesn't make the bar look empty
    const total = weekTodosAll.length;
    const done = weekTodosAll.filter((t) => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
    progressLabel.textContent = done + " / " + total + " 완료";
  }

  // ---------- all-list view: 이번달 1일 ~ 미래 전체 ----------
  function renderAllView() {
    const categories = TodoStore.getCategories();
    const priorities = TodoStore.getPriorities();
    const all = TodoStore.getTodos();
    const hideCompleted = TodoStore.getHideCompleted();

    const now = new Date();
    const monthStartIso = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayIso = isoDate(now);

    let filtered = all.filter((t) => t.due && t.due >= monthStartIso);
    if (hideCompleted) filtered = filtered.filter((t) => !t.completed);
    filtered.sort((a, b) => {
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      return (a.order || 0) - (b.order || 0);
    });

    allCountEl.textContent = filtered.length;
    allListContainer.innerHTML = "";
    allEmptyState.style.display = filtered.length === 0 ? "block" : "none";

    let globalIndex = 0;
    let lastDue = null;
    let currentGroupList = null;

    filtered.forEach((todo) => {
      if (todo.due !== lastDue) {
        lastDue = todo.due;
        const d = parseISODate(todo.due);
        const title = document.createElement("div");
        title.className = "date-group-title" + (todo.due === todayIso ? " is-today" : "");
        const y = d.getFullYear();
        const label = y === now.getFullYear()
          ? formatMD(d)
          : y + "." + (d.getMonth() + 1) + "." + d.getDate();
        title.innerHTML =
          "<span>" + label + "</span><span class=\"dow\">(" + DOW_KR[d.getDay()] + ")" +
          (todo.due === todayIso ? " · 오늘" : "") + "</span>";
        allListContainer.appendChild(title);

        currentGroupList = document.createElement("div");
        currentGroupList.className = "todo-list";
        allListContainer.appendChild(currentGroupList);
      }
      currentGroupList.appendChild(
        buildCard(todo, globalIndex, categories, priorities, { draggable: false })
      );
      globalIndex++;
    });
  }

  // ---------- drag reorder (pointer events) ----------
  function attachDragReorder(container) {
    let draggedEl = null;

    function getDragAfterElement(y) {
      const els = Array.from(container.querySelectorAll(".todo-card:not(.dragging)"));
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      els.forEach((child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          closest = { offset, element: child };
        }
      });
      return closest.element;
    }

    container.querySelectorAll(".drag-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        const card = handle.closest(".todo-card");
        if (!card) return;
        e.preventDefault();
        draggedEl = card;
        draggedEl.classList.add("dragging");

        // NOTE: pointer capture is intentionally NOT set on the handle here.
        // Reordering moves draggedEl via insertBefore/appendChild, which
        // reparents the handle and causes browsers to implicitly release
        // any pointer capture held by it mid-drag. Listening on `window`
        // instead keeps tracking the gesture regardless of DOM reparenting.
        const onMove = (ev) => {
          if (!draggedEl) return;
          const afterEl = getDragAfterElement(ev.clientY);
          if (afterEl == null) {
            if (container.lastElementChild !== draggedEl) container.appendChild(draggedEl);
          } else if (afterEl !== draggedEl.nextSibling) {
            container.insertBefore(draggedEl, afterEl);
          }
        };

        const onUp = () => {
          if (!draggedEl) return;
          draggedEl.classList.remove("dragging");
          const idsInOrder = Array.from(container.children).map((c) => c.dataset.id);
          TodoStore.reorder(idsInOrder);
          draggedEl = null;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          refresh();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      });
    });
  }

  // ---------- add sheet ----------
  const addSheetOverlay = document.getElementById("addSheetOverlay");
  const formCategory = document.getElementById("formCategory");
  const formPriority = document.getElementById("formPriority");
  const formDetail = document.getElementById("formDetail");
  const formDue = document.getElementById("formDue");

  function populateFormSelects() {
    const categories = TodoStore.getCategories();
    const priorities = TodoStore.getPriorities();
    formCategory.innerHTML = "";
    categories.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      formCategory.appendChild(o);
    });
    formPriority.innerHTML = "";
    priorities.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      formPriority.appendChild(o);
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => {
    populateFormSelects();
    formDetail.value = "";
    formDue.value = isoDate(refDate.getTime ? refDate : new Date());
    addSheetOverlay.classList.add("open");
    setTimeout(() => formDetail.focus(), 150);
  });

  document.getElementById("addCancelBtn").addEventListener("click", () => {
    addSheetOverlay.classList.remove("open");
  });
  addSheetOverlay.addEventListener("click", (e) => {
    if (e.target === addSheetOverlay) addSheetOverlay.classList.remove("open");
  });

  document.getElementById("addSaveBtn").addEventListener("click", () => {
    const detail = formDetail.value.trim();
    if (!detail) {
      formDetail.focus();
      return;
    }
    TodoStore.createTodo({
      category: formCategory.value,
      priority: formPriority.value,
      detail: detail,
      due: formDue.value || "",
    });
    addSheetOverlay.classList.remove("open");
    refresh();
  });

  // ---------- settings sheet ----------
  const settingsSheetOverlay = document.getElementById("settingsSheetOverlay");
  const catChipList = document.getElementById("catChipList");
  const priChipList = document.getElementById("priChipList");

  document.getElementById("settingsBtn").addEventListener("click", () => {
    renderSettingsChips();
    settingsSheetOverlay.classList.add("open");
  });
  document.getElementById("settingsDoneBtn").addEventListener("click", () => {
    settingsSheetOverlay.classList.remove("open");
    refresh();
  });
  settingsSheetOverlay.addEventListener("click", (e) => {
    if (e.target === settingsSheetOverlay) {
      settingsSheetOverlay.classList.remove("open");
      refresh();
    }
  });

  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab === "cat" ? "catPanel" : "priPanel").classList.add("active");
    });
  });

  function buildChipRow(item, kind) {
    const row = document.createElement("div");
    row.className = "chip-row";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "chip-color";
    colorInput.value = item.color;
    colorInput.addEventListener("input", () => {
      item.color = colorInput.value;
      persistChips();
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name;
    nameInput.placeholder = kind === "cat" ? "카테고리 이름" : "중요도 이름";
    nameInput.addEventListener("input", () => {
      item.name = nameInput.value;
      persistChips();
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "chip-remove";
    removeBtn.innerHTML = "✕";
    removeBtn.addEventListener("click", () => {
      const list = kind === "cat" ? currentCats : currentPris;
      if (list.length <= 1) {
        alert("최소 1개는 남아있어야 해요.");
        return;
      }
      const idx = list.indexOf(item);
      if (idx > -1) list.splice(idx, 1);
      reassignRemovedRefs(kind, item.id, list[0].id);
      persistChips();
      renderSettingsChips();
    });

    row.appendChild(colorInput);
    row.appendChild(nameInput);
    row.appendChild(removeBtn);
    return row;
  }

  function reassignRemovedRefs(kind, removedId, fallbackId) {
    const todos = TodoStore.getTodos();
    const field = kind === "cat" ? "category" : "priority";
    let changed = false;
    todos.forEach((t) => {
      if (t[field] === removedId) {
        t[field] = fallbackId;
        changed = true;
      }
    });
    if (changed) TodoStore.saveTodos(todos);
  }

  let currentCats = [];
  let currentPris = [];

  function renderSettingsChips() {
    currentCats = TodoStore.getCategories().map((c) => Object.assign({}, c));
    currentPris = TodoStore.getPriorities().map((p) => Object.assign({}, p));
    catChipList.innerHTML = "";
    currentCats.forEach((c) => catChipList.appendChild(buildChipRow(c, "cat")));
    priChipList.innerHTML = "";
    currentPris.forEach((p) => priChipList.appendChild(buildChipRow(p, "pri")));
  }

  function persistChips() {
    TodoStore.saveCategories(currentCats);
    TodoStore.savePriorities(currentPris);
  }

  document.getElementById("addCatBtn").addEventListener("click", () => {
    currentCats.push({ id: "cat_" + Date.now().toString(36), name: "새 카테고리", color: "#a78bfa" });
    persistChips();
    renderSettingsChips();
  });
  document.getElementById("addPriBtn").addEventListener("click", () => {
    currentPris.push({ id: "pri_" + Date.now().toString(36), name: "새 중요도", color: "#94a3b8" });
    persistChips();
    renderSettingsChips();
  });

  // ---------- PWA: service worker + install prompt ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.textContent = "⬇️";
    btn.title = "홈 화면에 추가";
    btn.style.marginRight = "0";
    btn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.remove();
    });
    document.querySelector(".header-actions").prepend(btn);
  });

  // ---------- daily quote (no label, just the line itself) ----------
  // Sits inline next to the title. If it's short enough to fit, it just
  // shows as static text; if it overflows the available width, it becomes
  // a seamlessly-looping horizontal marquee (two copies of the text placed
  // back to back, animated by exactly one copy's width) instead of wrapping
  // or getting cut off, so the whole phrase is always eventually visible.
  function setupDailyQuoteMarquee(wrapEl, text) {
    if (!wrapEl || !text) return;
    wrapEl.innerHTML = "";
    const track = document.createElement("div");
    track.className = "quote-track";
    const copy1 = document.createElement("span");
    copy1.className = "quote-copy";
    copy1.textContent = text;
    track.appendChild(copy1);
    wrapEl.appendChild(track);
    requestAnimationFrame(() => {
      if (copy1.scrollWidth > wrapEl.clientWidth) {
        const copy2 = document.createElement("span");
        copy2.className = "quote-copy";
        copy2.textContent = text;
        copy2.setAttribute("aria-hidden", "true");
        track.appendChild(copy2);
        track.classList.add("scrolling");
        const duration = Math.max(8, copy1.scrollWidth / 38);
        track.style.animationDuration = duration + "s";
      }
    });
  }
  if (typeof getDailyQuote === "function") {
    setupDailyQuoteMarquee(document.getElementById("dailyQuoteWrap"), getDailyQuote());
  }

  refresh();
})();
