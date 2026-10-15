/* Home — the vitrine rail and its tabs, the «پیشنهاد شگفت‌انگیز» rail and its
   countdown to midnight (Tehran). Everything else on the page is static HTML. */
(function () {
  "use strict";
  var PP = window.PP;
  var track = PP.$("[data-vitrine]"), tabs = PP.$("[data-vitrine-tabs]");
  if (!track || !tabs) return;
  var rail = track.closest("[data-rail]");

  var LISTS = {
    best: function () { return PP.P.filter(function (p) { return p.stock > 0; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10); },
    new: function () { return PP.P.filter(function (p) { return p.new && p.stock > 0; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10); },
    sale: function () { return PP.P.filter(function (p) { return p.off > 0 && p.stock > 0; }).sort(function (a, b) { return b.off - a.off; }).slice(0, 10); },
    sam: function () { return PP.P.filter(function (p) { return p.brand === "sam" && p.stock > 0; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10); }
  };

  function show(key) {
    PP.$$("[role=tab]", tabs).forEach(function (t) {
      var on = t.dataset.tab === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    track.innerHTML = LISTS[key]().map(function (p) { return PP.card(p); }).join("");
    if (rail && rail.refresh) rail.refresh();
  }

  tabs.addEventListener("click", function (e) {
    var t = e.target.closest("[role=tab]");
    if (t) show(t.dataset.tab);
  });
  tabs.addEventListener("keydown", function (e) {
    var all = PP.$$("[role=tab]", tabs), i = all.indexOf(document.activeElement);
    if (i < 0) return;
    // RTL: the next tab sits to the left
    var d = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    var n = all[(i + d + all.length) % all.length];
    n.focus();
    show(n.dataset.tab);
  });

  track.innerHTML = PP.skeletons(4);
  if (rail) PP.initRail(rail);
  show("best");

  // ------------------------------------------------------------ today's offers
  var offers = PP.$("[data-offers]");
  if (offers) {
    offers.innerHTML = PP.P.filter(function (p) { return p.off > 0 && p.stock > 0; })
      .sort(function (a, b) { return b.off - a.off; }).map(function (p) { return PP.card(p); }).join("");
    var orail = offers.closest("[data-rail]");
    if (orail) PP.initRail(orail);
  }
  var clock = PP.$("[data-countdown]");
  if (clock) {
    var hh = PP.$('[data-cd="h"]', clock), mm = PP.$('[data-cd="m"]', clock), ss = PP.$('[data-cd="s"]', clock);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var tick = function () {
      var left = Math.max(0, (1440 - PP.tehranNow().min) * 60 - new Date().getSeconds());
      hh.textContent = pad(Math.floor(left / 3600));
      mm.textContent = pad(Math.floor(left % 3600 / 60));
      ss.textContent = pad(left % 60);
    };
    tick();
    setInterval(tick, 1000);
  }
})();
