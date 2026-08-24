/* ============================================================
   TEMPORARY DIAGNOSTIC OVERLAY — NOT PART OF THE APP.
   Purpose: catch the exact element causing horizontal overflow on a
   real device, in a single screenshot, since this can't be reproduced
   in desktop devtools responsive mode.
   Delete this file and its <script src="debug-overflow.js"> tag once
   the real culprit is found and fixed.
   ============================================================ */
(function () {
  // An element clipped by an ancestor's overflow:hidden can still report
  // getBoundingClientRect().right past the viewport edge (e.g. the daily-
  // quote marquee, which is deliberately wider than its box for its scroll
  // animation) without actually causing any real page overflow. Skip those
  // so the banner only ever names genuine offenders.
  //
  // IMPORTANT: this walk stops BEFORE reaching <body>/<html>. Both already
  // carry overflow-x:hidden as a page-level guard, but this whole
  // investigation exists because that guard does NOT reliably stop visible
  // horizontal scroll / layout-viewport growth on real mobile browsers — so
  // treating body/html's own overflow-x:hidden as "safely clipped" would
  // hide the actual culprit element from this report.
  function isClippedByAncestor(el) {
    var p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      var cs = getComputedStyle(p);
      if (cs.overflow === "hidden" || cs.overflowX === "hidden") return true;
      p = p.parentElement;
    }
    return false;
  }

  function runCheck() {
    var docEl = document.documentElement;
    // IMPORTANT: on real mobile browsers, window.innerWidth is NOT a fixed
    // number — if page content overflows, mobile Chrome/Samsung Internet
    // silently GROWS the layout viewport (window.innerWidth) to match the
    // content width, so scrollWidth ends up equal to innerWidth even when
    // there IS real overflow (this was confirmed directly: injecting a
    // 900px-wide test element made window.innerWidth itself become 900,
    // while document.documentElement.clientWidth stayed at the true 360px
    // device width). So the correct comparison is scrollWidth vs
    // clientWidth, not vs innerWidth. innerWidth/screenWidth/visualViewport
    // are still shown in the banner as corroborating evidence — a real
    // innerWidth > clientWidth gap is itself proof this "viewport growth"
    // is happening on the device.
    var vw = docEl.clientWidth;
    var diff = docEl.scrollWidth - vw;
    var offenders = [];

    document.querySelectorAll("*").forEach(function (el) {
      if (el.id === "overflow-debug-banner" || el.closest("#overflow-debug-banner")) return;
      var r = el.getBoundingClientRect();
      if (r.right > vw + 0.5 && !isClippedByAncestor(el)) {
        el.style.outline = "3px solid red";
        var label = el.tagName.toLowerCase();
        if (el.id) label += "#" + el.id;
        if (el.className && typeof el.className === "string" && el.className.trim()) {
          label += "." + el.className.trim().split(/\s+/).join(".");
        }
        offenders.push(label + "  right=" + Math.round(r.right) + "px");
      }
    });

    var old = document.getElementById("overflow-debug-banner");
    if (old) old.remove();

    var vvWidth = window.visualViewport ? Math.round(window.visualViewport.width) : "N/A";
    var infoLine =
      "clientWidth=" + docEl.clientWidth +
      ", scrollWidth=" + docEl.scrollWidth +
      ", innerWidth=" + window.innerWidth +
      ", screenWidth=" + (screen ? screen.width : "N/A") +
      ", visualViewport=" + vvWidth +
      ", DPR=" + (window.devicePixelRatio || "?");

    if (diff > 0 || offenders.length > 0) {
      var banner = document.createElement("div");
      banner.id = "overflow-debug-banner";
      banner.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
        "background:#e5484d;color:#fff;font:bold 11px/1.5 monospace;" +
        "padding:8px 10px;white-space:pre-wrap;word-break:break-all;" +
        "box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;";
      banner.textContent =
        "[진단] 가로 초과: " + diff + "px  (" + infoLine + ")\n" +
        "범인 요소 (" + offenders.length + "개):\n" +
        offenders.join("\n");
      document.body.appendChild(banner);
    } else {
      // Still show a small green confirmation so a screenshot proves the
      // check actually ran and found nothing at that moment, rather than
      // looking like it silently failed to load.
      var ok = document.createElement("div");
      ok.id = "overflow-debug-banner";
      ok.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
        "background:#2e9e5b;color:#fff;font:bold 11px/1.5 monospace;" +
        "padding:6px 10px;white-space:pre-wrap;word-break:break-all;pointer-events:none;";
      ok.textContent = "[진단] 가로 초과 없음 (" + infoLine + ")";
      document.body.appendChild(ok);
    }
  }

  var pending = null;
  function scheduleCheck(delay) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(runCheck, delay == null ? 250 : delay);
  }

  if (document.readyState === "complete") scheduleCheck(400);
  else window.addEventListener("load", function () { scheduleCheck(400); });

  // The real-world repro is "open the app, THEN add one todo" — overflow
  // that only appears after that DOM change would be invisible to a single
  // load-time check. A debounced MutationObserver re-runs the check after
  // any DOM change (adding a todo, expanding a filter, opening a sheet),
  // and resize/orientation change is covered separately.
  var observer = new MutationObserver(function () {
    scheduleCheck(300);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  window.addEventListener("resize", function () {
    scheduleCheck(300);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      scheduleCheck(200);
    });
  }
})();
