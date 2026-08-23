// calendar.js — calendar.html logic
(function () {
  const { isoDate, isSameDay, getWeekRange, addDays, formatMD, DOW_KR } = DateUtil;

  const qs = new URLSearchParams(location.search);
  let viewDate = new Date();
  const qMonth = qs.get("month");
  if (qMonth) {
    const parts = qMonth.split("-").map(Number);
    if (parts.length === 2 && !parts.some(isNaN)) {
      viewDate = new Date(parts[0], parts[1] - 1, 1);
    }
  }
  let agendaRefDate = new Date();
  let currentCalView = "month"; // "month" | "week"

  const monthLabelEl = document.getElementById("monthLabel");
  const dowRowEl = document.getElementById("dowRow");
  const calGridEl = document.getElementById("calGrid");
  const legendEl = document.getElementById("legend");

  const monthNavWrap = document.getElementById("monthNavWrap");
  const weekAgendaNavWrap = document.getElementById("weekAgendaNavWrap");
  const monthViewSection = document.getElementById("monthViewSection");
  const weekAgendaSection = document.getElementById("weekAgendaSection");
  const agendaWeekLabelEl = document.getElementById("agendaWeekLabel");
  const weekAgendaListEl = document.getElementById("weekAgendaList");

  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    refresh();
  });
  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    refresh();
  });
  document.getElementById("todayBtn").addEventListener("click", () => {
    viewDate = new Date();
    refresh();
  });

  document.getElementById("prevAgendaWeekBtn").addEventListener("click", () => {
    agendaRefDate = addDays(agendaRefDate, -7);
    refresh();
  });
  document.getElementById("nextAgendaWeekBtn").addEventListener("click", () => {
    agendaRefDate = addDays(agendaRefDate, 7);
    refresh();
  });
  document.getElementById("agendaTodayBtn").addEventListener("click", () => {
    agendaRefDate = new Date();
    refresh();
  });

  document.querySelectorAll("#calSubTabs .sub-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentCalView = tab.dataset.view;
      document.querySelectorAll("#calSubTabs .sub-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isMonth = currentCalView === "month";
      monthNavWrap.style.display = isMonth ? "block" : "none";
      weekAgendaNavWrap.style.display = isMonth ? "none" : "block";
      monthViewSection.style.display = isMonth ? "block" : "none";
      weekAgendaSection.style.display = isMonth ? "none" : "block";
      refresh();
    });
  });

  // "완료된 항목 숨기기" — shared with index.html via TodoStore, so toggling
  // it here or on the 할일 tab keeps both screens in sync.
  const hideCompletedChk = document.getElementById("hideCompletedChk");
  hideCompletedChk.checked = TodoStore.getHideCompleted();
  hideCompletedChk.addEventListener("change", () => {
    TodoStore.setHideCompleted(hideCompletedChk.checked);
    refresh();
  });

  function refresh() {
    if (currentCalView === "month") renderMonthView();
    else renderWeekAgenda();
  }

  // Monday-first weekday order to match index.html week logic
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

  function renderDow() {
    dowRowEl.innerHTML = "";
    DOW_ORDER.forEach((d) => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = DOW_KR[d];
      dowRowEl.appendChild(el);
    });
  }

  function renderMonthView() {
    monthLabelEl.querySelector(".main").textContent =
      viewDate.getFullYear() + "년 " + (viewDate.getMonth() + 1) + "월";

    renderDow();

    const priorities = TodoStore.getPriorities();
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));
    const hideCompleted = TodoStore.getHideCompleted();
    const todos = TodoStore.getTodos().filter((t) => !hideCompleted || !t.completed);
    const todosByDate = new Map();
    todos.forEach((t) => {
      if (!t.due) return;
      if (!todosByDate.has(t.due)) todosByDate.set(t.due, []);
      todosByDate.get(t.due).push(t);
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstDow = firstOfMonth.getDay(); // 0 Sun..6 Sat
    const leading = firstDow === 0 ? 6 : firstDow - 1; // days before Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    calGridEl.innerHTML = "";
    const today = new Date();

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - leading + 1;
      const cell = document.createElement("div");

      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.className = "cal-cell empty";
        calGridEl.appendChild(cell);
        continue;
      }

      const cellDate = new Date(year, month, dayNum);
      const iso = isoDate(cellDate);
      cell.className = "cal-cell";
      if (isSameDay(cellDate, today)) cell.classList.add("today");

      const dayLabel = document.createElement("div");
      dayLabel.textContent = dayNum;
      cell.appendChild(dayLabel);

      const items = todosByDate.get(iso) || [];
      if (items.length > 0) {
        const dotsWrap = document.createElement("div");
        dotsWrap.className = "cal-dots";
        items.slice(0, 4).forEach((t) => {
          const dot = document.createElement("div");
          dot.className = "cal-dot";
          const pr = priorityMap.get(t.priority);
          dot.style.backgroundColor = pr ? pr.color : "#c7c9d6";
          dotsWrap.appendChild(dot);
        });
        cell.appendChild(dotsWrap);

        if (items.length > 0) {
          const countEl = document.createElement("div");
          countEl.className = "cal-count";
          countEl.textContent = items.length;
          cell.appendChild(countEl);
        }
      }

      cell.addEventListener("click", () => {
        location.href = "index.html?week=" + iso;
      });

      calGridEl.appendChild(cell);
    }

    // legend
    legendEl.innerHTML = "";
    priorities.forEach((p) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.marginBottom = "6px";
      row.style.fontSize = "13.5px";
      const dot = document.createElement("span");
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "50%";
      dot.style.background = p.color;
      dot.style.display = "inline-block";
      row.appendChild(dot);
      const label = document.createElement("span");
      label.textContent = p.name;
      row.appendChild(label);
      legendEl.appendChild(row);
    });
  }

  // ---------- week agenda view: 이번주 7일을 가로로 한눈에 ----------
  const MAX_ITEMS_PER_DAY = 3;

  function renderWeekAgenda() {
    const { start } = getWeekRange(agendaRefDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    const isCurrentWeek = isSameDay(getWeekRange(new Date()).start, start);
    agendaWeekLabelEl.querySelector(".main").textContent =
      formatMD(days[0]) + " ~ " + formatMD(days[6]) + (isCurrentWeek ? " · 이번주" : "");

    const priorities = TodoStore.getPriorities();
    const priorityMap = new Map(priorities.map((p) => [p.id, p]));
    const hideCompleted = TodoStore.getHideCompleted();
    const todos = TodoStore.getTodos().filter((t) => !hideCompleted || !t.completed);
    const todosByDate = new Map();
    todos.forEach((t) => {
      if (!t.due) return;
      if (!todosByDate.has(t.due)) todosByDate.set(t.due, []);
      todosByDate.get(t.due).push(t);
    });

    const today = new Date();
    weekAgendaListEl.innerHTML = "";

    days.forEach((d) => {
      const iso = isoDate(d);
      const items = (todosByDate.get(iso) || []).sort((a, b) => (a.order || 0) - (b.order || 0));

      const card = document.createElement("div");
      card.className = "day-card" + (isSameDay(d, today) ? " today" : "");

      const head = document.createElement("div");
      head.className = "day-card-head";
      const dNum = document.createElement("span");
      dNum.className = "d-num";
      dNum.textContent = d.getDate();
      const dDow = document.createElement("span");
      dDow.className = "d-dow";
      dDow.textContent = isSameDay(d, today) ? "오늘" : DOW_KR[d.getDay()];
      head.appendChild(dNum);
      head.appendChild(dDow);
      if (items.length > 0) {
        const count = document.createElement("span");
        count.className = "d-count";
        count.textContent = items.length + "개";
        head.appendChild(count);
      }
      card.appendChild(head);

      const list = document.createElement("div");
      list.className = "day-mini-list";

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "day-mini-empty";
        empty.textContent = "-";
        list.appendChild(empty);
      } else {
        const shown = items.slice(0, MAX_ITEMS_PER_DAY);
        shown.forEach((t) => {
          const row = document.createElement("div");
          row.className = "day-mini-item" + (t.completed ? " done" : "");
          const dot = document.createElement("span");
          dot.className = "day-mini-dot";
          const pr = priorityMap.get(t.priority);
          dot.style.backgroundColor = pr ? pr.color : "#c7c9d6";
          const text = document.createElement("span");
          text.className = "day-mini-text";
          text.textContent = t.detail || "(내용 없음)";
          row.appendChild(dot);
          row.appendChild(text);
          list.appendChild(row);
        });
        if (items.length > MAX_ITEMS_PER_DAY) {
          const more = document.createElement("div");
          more.className = "day-mini-more";
          more.textContent = "+" + (items.length - MAX_ITEMS_PER_DAY);
          list.appendChild(more);
        }
      }
      card.appendChild(list);

      card.addEventListener("click", () => {
        location.href = "index.html?week=" + iso;
      });

      weekAgendaListEl.appendChild(card);
    });
  }

  // ---------- daily quote (no label, just the line itself) ----------
  // Sits inline next to the title; becomes a seamlessly-looping marquee
  // (two copies back to back, animated by exactly one copy's width) only
  // when the phrase is too long to fit — see app.js for the same helper.
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
