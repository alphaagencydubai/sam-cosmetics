/* Sam Cosmetics — shared runtime for every page.
   Store (this browser only while SITE.demo), product cards, cart drawer with a
   short checkout, search, the quick-add picker, toasts and the layer manager.
   Page scripts reach it through window.PP. */
(function () {
  "use strict";

  var D = window.SAM;
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var DEMO = !!D.site.demo;

  // ------------------------------------------------------------ opening splash
  // CSS plays and lifts it on its own; this only lets a tap or key cut it
  // short and takes it out of the page once it has gone.
  (function () {
    var el = document.querySelector(".intro");
    if (!el) return;
    if (document.documentElement.classList.contains("intro-off")) { el.parentNode.removeChild(el); return; }
    function skip() { el.classList.add("is-skip"); }
    el.addEventListener("pointerdown", skip);
    document.addEventListener("keydown", skip, { once: true });
    el.addEventListener("animationend", function (e) {
      if (e.target === el && el.parentNode) el.parentNode.removeChild(el);
    });
  })();

  // ------------------------------------------------------------ utils
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function rich(s) { return esc(s).replace(/\{([^}]*)\}/g, '<span class="lat" dir="ltr">$1</span>'); }
  function plain(s) { return String(s || "").replace(/[{}]/g, ""); }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString("en-US"); }
  var FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
  function toLatin(s) {
    return String(s == null ? "" : s)
      .replace(/[۰-۹]/g, function (d) { return String(FA.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String(AR.indexOf(d)); });
  }
  function norm(s) {
    return toLatin(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[\u064A\u0649]/g, "\u06CC").replace(/\u0643/g, "\u06A9").replace(/\u0629/g, "\u0647")
      .replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/\u0624/g, "\u0648")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[\u200C\u200D\u00A0]/g, " ")
      .replace(/[^\p{L}\p{N}%\u066A+]+/gu, " ").replace(/\s+/g, " ").trim();
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
  function icon(n, cls) { return '<svg class="' + (cls || "i") + '" aria-hidden="true" focusable="false" width="24" height="24"><use href="#i-' + n + '"/></svg>'; }
  function uid(n) {
    var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < (n || 5); i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function phoneNorm(v) {
    var d = toLatin(v).replace(/[^0-9]/g, "");
    if (d.indexOf("0098") === 0) d = "0" + d.slice(4);
    else if (d.indexOf("98") === 0 && d.length === 12) d = "0" + d.slice(2);
    else if (d.length === 10 && d[0] === "9") d = "0" + d;
    return d;
  }
  function phoneOk(v) { return /^09[0-9]{9}$/.test(phoneNorm(v)); }
  function phoneShow(v) { var d = phoneNorm(v); return d.length === 11 ? d.slice(0, 4) + " " + d.slice(4, 7) + " " + d.slice(7) : d; }
  function ltr(s, cls) { return '<bdi class="ltr' + (cls ? " " + cls : "") + '">' + esc(s) + "</bdi>"; }

  // ------------------------------------------------------------ calendar (Jalali, Tehran)
  function g2j(gy, gm, gd) {
    var gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    return [jy, jm, jd];
  }
  function j2g(jy, jm, jd) {
    jy += 1595;
    var days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    var gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var gd = days + 1;
    var sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm = 0;
    for (gm = 0; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
    return [gy, gm, gd];
  }
  function jLen(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    var g = j2g(jy, 12, 30), back = g2j(g[0], g[1], g[2]);
    return back[1] === 12 ? 30 : 29;
  }
  var MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  var WEEK = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];   // by JS getDay()
  function iso(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  function parseISO(s) { var a = String(s).split("-").map(Number); return { y: a[0], m: a[1], d: a[2] }; }
  function weekday(s) { var p = parseISO(s); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function addDays(s, n) { var p = parseISO(s), t = new Date(Date.UTC(p.y, p.m - 1, p.d + n)); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function faDate(s, withWeek) {
    var p = parseISO(s), j = g2j(p.y, p.m, p.d);
    return (withWeek ? WEEK[weekday(s)] + " " : "") + j[2] + " " + MONTHS[j[1] - 1] + " " + j[0];
  }
  function faDay(s) { var p = parseISO(s), j = g2j(p.y, p.m, p.d); return { d: j[2], m: MONTHS[j[1] - 1], y: j[0], w: WEEK[weekday(s)] }; }
  /* Tehran wall-clock now, whatever the device's zone; Iran has no DST since 2022. */
  function tehranNow() {
    var d = new Date();
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { date: o.year + "-" + o.month + "-" + o.day, min: Number(o.hour) * 60 + Number(o.minute) };
    } catch (e) {
      return { date: iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  function hm(min) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
  function toMin(s) { var a = String(s).split(":").map(Number); return a[0] * 60 + a[1]; }

  // ------------------------------------------------------------ catalogue indexes
  var P = D.products;
  var byId = {}, CAT = {}, SUB = {}, BRAND = {}, SKIN = {}, CONCERN = {};
  D.cats.forEach(function (c) { CAT[c.id] = c; c.subs.forEach(function (s) { SUB[s.id] = { id: s.id, name: s.name, cat: c.id }; }); });
  D.brands.forEach(function (b) { BRAND[b.id] = b; });
  D.skin.forEach(function (s) { SKIN[s.id] = s; });
  D.concerns.forEach(function (s) { CONCERN[s.id] = s; });
  P.forEach(function (p) {
    byId[p.id] = p;
    p.off = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
    p.hay = norm([plain(p.name), p.en, BRAND[p.brand].en, BRAND[p.brand].fa, CAT[p.cat].name, SUB[p.sub].name].join(" "));
    p.hayNS = p.hay.replace(/\s+/g, "");
  });
  function matchQ(p, q) {
    var n = norm(q);
    if (!n) return true;
    return n.split(" ").every(function (t) { return p.hay.indexOf(t) > -1 || p.hayNS.indexOf(t) > -1; });
  }
  function img(p, shade) {
    var i = shade && p.shadeArt ? p.shades.map(function (s) { return s.name; }).indexOf(shade) : -1;
    return ROOT + "assets/p/" + p.id + (i > 0 ? "--" + (i + 1) : "") + ".svg";
  }
  function url(p) { return ROOT + "product/" + p.id + "/"; }

  // ------------------------------------------------------------ store
  var KEY = "sam.v1";
  function blank() { return { cart: [], favs: [], session: null, accounts: {}, bookings: [], orders: [] }; }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var v = JSON.parse(raw), b = blank();
        Object.keys(b).forEach(function (k) { if (v[k] == null || typeof v[k] !== typeof b[k]) v[k] = b[k]; });
        if (!Array.isArray(v.cart)) v.cart = [];
        if (!Array.isArray(v.favs)) v.favs = [];
        v.cart = v.cart.filter(function (l) { return l && byId[l.id] && byId[l.id].stock > 0 && l.qty > 0; });
        v.favs = v.favs.filter(function (id) { return byId[id]; });
        return v;
      }
    } catch (e) { /* private mode or corrupt — start clean */ }
    return blank();
  }
  var S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
    emit();
  }
  function emit() { document.dispatchEvent(new CustomEvent("store")); }
  window.addEventListener("storage", function (e) { if (e.key === KEY) { S = load(); emit(); } });

  function lineKey(id, v) { return id + "|" + (v || ""); }
  var store = {
    get state() { return S; },
    // cart
    cart: function () { return S.cart.filter(function (l) { return byId[l.id]; }); },
    cartCount: function () { return S.cart.reduce(function (n, l) { return n + l.qty; }, 0); },
    add: function (id, variant, qty) {
      var p = byId[id]; if (!p || p.stock < 1) return 0;
      var k = lineKey(id, variant), line = S.cart.filter(function (l) { return lineKey(l.id, l.v) === k; })[0];
      var max = Math.min(p.stock, 10), want = (line ? line.qty : 0) + (qty || 1), put = Math.min(want, max);
      if (line) line.qty = put; else S.cart.push({ id: id, v: variant || "", qty: put });
      save();
      return put - (want - (qty || 1)) > 0 ? put : 0;
    },
    setQty: function (key, q) {
      S.cart.forEach(function (l) { if (lineKey(l.id, l.v) === key) l.qty = Math.max(1, Math.min(q, Math.min(byId[l.id].stock, 10))); });
      save();
    },
    remove: function (key) { S.cart = S.cart.filter(function (l) { return lineKey(l.id, l.v) !== key; }); save(); },
    clearCart: function () { S.cart = []; save(); },
    totals: function () {
      var sub = 0, full = 0;
      S.cart.forEach(function (l) { var p = byId[l.id]; if (!p) return; sub += p.price * l.qty; full += (p.old || p.price) * l.qty; });
      return { full: full, off: full - sub, total: sub };
    },
    // favourites
    isFav: function (id) { return S.favs.indexOf(id) > -1; },
    toggleFav: function (id) {
      var on = !store.isFav(id);
      if (on) S.favs.unshift(id); else S.favs = S.favs.filter(function (x) { return x !== id; });
      save();
      return on;
    },
    favs: function () { return S.favs.map(function (id) { return byId[id]; }).filter(Boolean); },
    // account
    user: function () { return S.session && S.accounts[S.session] ? S.accounts[S.session] : null; },
    login: function (phone) {
      var ph = phoneNorm(phone);
      if (!S.accounts[ph]) S.accounts[ph] = { phone: ph, name: "", email: "", birth: null, skin: "", concerns: [], addresses: [], created: Date.now() };
      S.session = ph;
      save();
      return S.accounts[ph];
    },
    logout: function () { S.session = null; save(); },
    updateUser: function (patch) { var u = store.user(); if (!u) return; Object.keys(patch).forEach(function (k) { u[k] = patch[k]; }); save(); },
    // bookings & orders — kept per phone
    bookings: function (phone) { var ph = phoneNorm(phone); return S.bookings.filter(function (b) { return b.phone === ph; }); },
    allBookings: function () { return S.bookings; },
    addBooking: function (b) { S.bookings.push(b); save(); },
    cancelBooking: function (id) { S.bookings.forEach(function (b) { if (b.id === id) b.status = "cancelled"; }); save(); },
    orders: function (phone) { var ph = phoneNorm(phone); return S.orders.filter(function (o) { return o.phone === ph; }); },
    addOrder: function (o) { S.orders.push(o); save(); }
  };

  // ------------------------------------------------------------ product card
  function priceHTML(p) {
    if (p.stock < 1) return '<span class="card__out">ناموجود</span>';
    return '<span class="price"><b>' + fmt(p.price) + "</b> <span>تومان</span></span>" +
      (p.off ? '<s class="price__old">' + fmt(p.old) + "</s>" : "");
  }
  function card(p, opts) {
    opts = opts || {};
    var name = plain(p.name), fav = store.isFav(p.id);
    var badges = (p.new ? '<span class="badge">تازه</span>' : "") +
      (p.off && p.stock > 0 ? '<span class="badge badge--off">' + p.off + "٪</span>" : "") +
      (p.stock < 1 ? '<span class="badge badge--out">ناموجود</span>' : "");
    var shades = p.shades.length ? '<div class="card__shades" aria-label="' + p.shades.length + ' رنگ">' +
      p.shades.slice(0, 4).map(function (s) { return '<i style="--c:' + s.hex + '"></i>'; }).join("") +
      '<span>' + p.shades.length + " رنگ</span></div>" : "";
    return '<article class="card' + (p.stock < 1 ? " is-out" : "") + '" data-id="' + p.id + '">' +
      '<div class="card__media">' +
        '<a class="card__img" href="' + url(p) + '" tabindex="-1" aria-hidden="true"><img src="' + img(p) + '" alt="" width="600" height="600"' + (opts.lazy ? ' loading="lazy"' : "") + ' decoding="async"></a>' +
        '<div class="badges">' + badges + "</div>" +
        '<button class="card__fav" type="button" data-fav="' + p.id + '" aria-pressed="' + fav + '" aria-label="' + (fav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها") + ": " + esc(name) + '">' + icon("heart") + "</button>" +
        (p.stock > 0 ? '<button class="card__add" type="button" data-quick-add="' + p.id + '" aria-label="افزودن به سبد: ' + esc(name) + '">' + icon("plus") + "</button>" : "") +
      "</div>" +
      '<a class="card__body" href="' + url(p) + '"><span class="card__brand lat" lang="en">' + esc(BRAND[p.brand].en) + '</span><h3 class="card__name">' + rich(p.name) + "</h3></a>" +
      '<p class="card__price">' + priceHTML(p) + "</p>" + shades +
      "</article>";
  }
  function skeletons(n) { var s = ""; for (var i = 0; i < n; i++) s += '<div class="skel" aria-hidden="true"></div>'; return s; }

  // ------------------------------------------------------------ toasts
  function toast(msg, opt) {
    opt = opt || {};
    var host = $("[data-toasts]"); if (!host) return;
    while (host.children.length > 1) host.removeChild(host.firstChild);
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.innerHTML = icon(opt.icon || "check") + "<span>" + msg + "</span>" +
      (opt.action ? (opt.action.href ? '<a href="' + opt.action.href + '">' + esc(opt.action.label) + "</a>" : '<button type="button">' + esc(opt.action.label) + "</button>") : "");
    if (opt.action && opt.action.onClick) {
      t.querySelector("button").addEventListener("click", function () { dismiss(); opt.action.onClick(); });
    }
    host.appendChild(t);
    var gone = false;
    function dismiss() { if (gone) return; gone = true; t.classList.add("is-out"); setTimeout(function () { t.remove(); }, 260); }
    setTimeout(dismiss, opt.ms || 3400);
  }

  // ------------------------------------------------------------ layers
  /* Drawer, search, picker and the phone filter sheet. Each open layer owns one
     history entry so the back button closes it; close() resolves once that pop
     has landed, so anything writing the URL afterwards writes it onto the right
     entry. Links inside an open layer close it before navigating, so no dead
     entries are left behind. */
  var Layers = (function () {
    var stack = [], focusBack = new Map(), waiting = [], after = [];
    function top() { return stack[stack.length - 1]; }
    function panelOf(el) { return el.querySelector(".drawer__panel, .search__panel, .sheet__panel, .filters__panel"); }
    function open(el, focusSel) {
      if (!el || stack.indexOf(el) > -1) return;
      $$(".toast").forEach(function (t) { t.remove(); });
      focusBack.set(el, document.activeElement);
      el.classList.add("is-open");
      void el.offsetWidth;
      el.classList.add("is-in");
      stack.push(el);
      document.body.classList.add("is-locked");
      try { history.pushState(Object.assign({}, history.state || {}, { layer: el.id }), ""); } catch (e) { /* sandboxed */ }
      var f = (focusSel && el.querySelector(focusSel)) || panelOf(el);
      setTimeout(function () { if (f) f.focus({ preventScroll: true }); }, 40);
      el.dispatchEvent(new CustomEvent("layer:open"));
    }
    function hide(el) {
      var i = stack.indexOf(el);
      if (i < 0) return;
      stack.splice(i, 1);
      el.classList.remove("is-in");
      setTimeout(function () { if (!el.classList.contains("is-in")) el.classList.remove("is-open"); }, 360);
      if (!stack.length) document.body.classList.remove("is-locked");
      var back = focusBack.get(el);
      if (back && document.contains(back) && back.focus) back.focus({ preventScroll: true });
      el.dispatchEvent(new CustomEvent("layer:close"));
    }
    function close(el) {
      if (!el || stack.indexOf(el) < 0) return Promise.resolve();
      if (history.state && history.state.layer === el.id) {
        return new Promise(function (res) { waiting.push(res); history.back(); setTimeout(flush, 600); });
      }
      hide(el);
      return Promise.resolve().then(flush);
    }
    function flush() {
      waiting.splice(0).forEach(function (r) { r(); });
      if (!stack.length) after.splice(0).forEach(function (fn) { fn(); });
    }
    function closeAll() { return stack.length ? close(stack[0]) : Promise.resolve(); }
    window.addEventListener("popstate", function (e) {
      var want = e.state && e.state.layer;
      var closed = false;
      while (stack.length && top().id !== want) { hide(top()); closed = true; }
      e.samLayer = closed || !!waiting.length;
      flush();
    });
    // a fresh load can land on an entry a layer once owned — neutralise it
    if (history.state && history.state.layer) {
      try { var st = Object.assign({}, history.state); delete st.layer; history.replaceState(st, ""); } catch (e) { /* ignore */ }
    }
    document.addEventListener("keydown", function (e) {
      var el = top(); if (!el) return;
      if (e.key === "Escape") { e.preventDefault(); close(el); return; }
      if (e.key === "Tab") {
        var f = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])', panelOf(el))
          .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panelOf(el).contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a || !stack.length || !top().contains(a) || e.defaultPrevented) return;
      if (a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(tel|mailto):/.test(href)) return;
      e.preventDefault();
      closeAll().then(function () { location.assign(a.href); });
    });
    return {
      open: open, close: close, closeAll: closeAll, isOpen: function (el) { return stack.indexOf(el) > -1; },
      any: function () { return stack.length > 0; },
      /* run fn now if nothing is open, otherwise once the last layer has closed */
      whenClear: function (fn) { if (!stack.length && !waiting.length) fn(); else after.push(fn); }
    };
  })();

  // ------------------------------------------------------------ quick add + picker
  var picker = $("#picker");
  function quickAdd(id, from) {
    var p = byId[id]; if (!p || p.stock < 1) return;
    if (!p.shades.length) { addToCart(id, "", 1); return; }
    var body = $("[data-picker-body]", picker);
    body.innerHTML =
      '<header class="sheet__head"><h2 id="picker-title">انتخاب رنگ</h2><button class="iconbtn" type="button" data-close aria-label="بستن">' + icon("x") + "</button></header>" +
      '<div class="sheet__prod"><img src="' + img(p) + '" alt=""><div><b>' + rich(p.name) + "</b>" + priceHTML(p) + "</div></div>" +
      '<fieldset class="pp__shades"><legend>رنگ: <b data-pick-name>' + esc(p.shades[0].name) + "</b></legend><div class=\"swatches\">" +
      p.shades.map(function (s, i) {
        return '<label class="swatch" style="--sw:' + s.hex + '"><input type="radio" name="pick" value="' + esc(s.name) + '"' + (i ? "" : " checked") + '><span class="swatch__dot" aria-hidden="true"></span><span class="visually-hidden">' + esc(s.name) + "</span></label>";
      }).join("") + "</div></fieldset>" +
      '<button class="btn btn--block" type="button" data-pick-add style="margin-top:22px">' + icon("bag") + "افزودن به سبد</button>";
    body.onchange = function (e) {
      if (e.target.name !== "pick") return;
      $("[data-pick-name]", body).textContent = e.target.value;
      $(".sheet__prod img", body).src = img(p, e.target.value);
    };
    $("[data-pick-add]", body).onclick = function () {
      var v = ($('input[name="pick"]:checked', body) || {}).value || "";
      Layers.close(picker).then(function () { addToCart(id, v, 1); });
    };
    Layers.open(picker, 'input[name="pick"]:checked');
  }
  function addToCart(id, v, qty) {
    var p = byId[id];
    var before = store.cartCount();
    store.add(id, v, qty);
    if (store.cartCount() === before) { toast("از این کالا بیشتر از این موجود نیست.", { icon: "info" }); return; }
    bump();
    toast("«" + esc(plain(p.name)) + "» به سبد اضافه شد" + (v ? " (" + esc(v) + ")" : ""), { action: { label: "مشاهده‌ی سبد", onClick: openCart } });
  }
  function bump() {
    $$("[data-cart-count]").forEach(function (b) {
      if (b.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) b.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
    });
  }

  // ------------------------------------------------------------ cart drawer
  var cartEl = $("#cart");
  var cartView = "cart";
  function variantHex(p, v) { var s = p.shades.filter(function (x) { return x.name === v; })[0]; return s ? s.hex : null; }
  function renderCart() {
    if (!cartEl) return;
    var body = $("[data-cart-body]", cartEl), foot = $("[data-cart-foot]", cartEl);
    var lines = store.cart();
    $("#cart-title").textContent = cartView === "checkout" ? "ثبت سفارش" : (cartView === "done" ? "سفارش ثبت شد" : "سبد خرید");
    if (cartView === "done") return;
    if (!lines.length) {
      cartView = "cart";
      $("#cart-title").textContent = "سبد خرید";
      body.innerHTML = '<div class="empty"><svg class="empty__mark" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-bag"/></svg>' +
        "<h2>سبد خریدت خالی است</h2><p>محصولی که دوست داری را با دکمه‌ی + روی کارت محصول اضافه کن.</p>" +
        '<div class="empty__acts"><a class="btn" href="' + ROOT + 'products/">مشاهده‌ی محصولات</a></div></div>';
      body.querySelector(".empty__mark").setAttribute("style", "width:56px;height:56px;fill:none;stroke:var(--rose);stroke-width:1.4");
      foot.innerHTML = "";
      return;
    }
    var t = store.totals();
    var sum = '<dl class="sum">' +
      "<div><dt>جمع کالاها (" + store.cartCount() + ")</dt><dd>" + fmt(t.full) + " تومان</dd></div>" +
      (t.off ? '<div class="sum__off"><dt>تخفیف</dt><dd>' + fmt(t.off) + " تومان</dd></div>" : "") +
      '<div class="sum__total"><dt>مبلغ قابل پرداخت</dt><dd>' + fmt(t.total) + " تومان</dd></div></dl>";
    if (cartView === "checkout") { renderCheckout(body, foot, sum); return; }
    body.innerHTML = lines.map(function (l) {
      var p = byId[l.id], key = lineKey(l.id, l.v), hex = l.v ? variantHex(p, l.v) : null;
      return '<div class="line">' +
        '<a class="line__img" href="' + url(p) + '"><img src="' + img(p, l.v) + '" alt=""></a>' +
        "<div>" +
          '<a class="line__name" href="' + url(p) + '">' + rich(p.name) + "</a>" +
          (l.v ? '<div class="line__meta">' + (hex ? '<i style="--c:' + hex + '"></i>' : "") + esc(l.v) + "</div>" : "") +
          '<div class="line__row">' +
            '<div class="qty qty--sm"><button type="button" data-line-dec="' + esc(key) + '" aria-label="یکی کمتر"' + (l.qty <= 1 ? " disabled" : "") + ">" + icon("minus") + '</button><output aria-live="polite">' + l.qty + '</output><button type="button" data-line-inc="' + esc(key) + '" aria-label="یکی بیشتر"' + (l.qty >= Math.min(p.stock, 10) ? " disabled" : "") + ">" + icon("plus") + "</button></div>" +
            '<span class="price"><b>' + fmt(p.price * l.qty) + "</b> <span>تومان</span></span>" +
            '<button class="iconbtn line__rm" type="button" data-line-rm="' + esc(key) + '" aria-label="حذف از سبد: ' + esc(plain(p.name)) + '">' + icon("trash") + "</button>" +
          "</div>" +
        "</div></div>";
    }).join("");
    foot.innerHTML = sum + '<button class="btn btn--block" type="button" data-checkout>ادامه‌ی ثبت سفارش' + icon("chev-l") + "</button>";
  }
  function renderCheckout(body, foot, sum) {
    var u = store.user() || {};
    var a = (u.addresses || [])[0] || {};
    var d = checkoutDraft || { name: u.name || a.receiver || "", phone: u.phone || "", ship: D.site.ship[0].id, addr: a.line ? (a.city ? a.city + "، " : "") + a.line : "", note: "" };
    checkoutDraft = d;
    body.innerHTML =
      '<form class="form" data-checkout-form novalidate style="padding-top:12px">' +
        '<div class="opts">' +
          D.site.ship.map(function (s) { return opt("ship", s.id, s.name, s.addr ? s.when : s.when + "؛ " + D.site.address_short, s.addr ? "truck" : "store", d.ship === s.id); }).join("") +
        "</div>" +
        '<p class="note" style="margin-top:-4px">' + icon("info") + "<span>" + esc(D.site.ship_cost) + "</span></p>" +
        field("name", "نام و نام خانوادگی", '<input class="input" name="name" autocomplete="name" value="' + esc(d.name) + '" required>') +
        field("phone", "شماره‌ی موبایل", '<input class="input input--ltr" name="phone" inputmode="numeric" autocomplete="tel" dir="ltr" placeholder="0912 345 6789" value="' + esc(d.phone) + '" required>') +
        '<div data-addr-wrap' + (needsAddr(d.ship) ? "" : " hidden") + ">" + field("addr", "آدرس کامل", '<textarea class="textarea" name="addr" autocomplete="street-address" rows="3">' + esc(d.addr) + "</textarea>") + "</div>" +
        field("note", "توضیحات (اختیاری)", '<input class="input" name="note" value="' + esc(d.note) + '">') +
        (DEMO ? '<p class="note note--demo">' + icon("info") + "<span>نسخه‌ی نمایشی: سفارش فقط در همین مرورگر ثبت می‌شود و پرداختی انجام نمی‌شود. درگاه پرداخت هنگام راه‌اندازی وصل می‌شود.</span></p>" : "") +
      "</form>";
    foot.innerHTML = sum + '<div style="display:flex;gap:10px"><button class="btn btn--ghost" type="button" data-back-cart>بازگشت</button><button class="btn btn--grow" type="button" data-place-order>ثبت سفارش</button></div>';
    var form = $("[data-checkout-form]", body);
    form.addEventListener("input", function (e) {
      if (e.target.name) d[e.target.name] = e.target.value;
      if (e.target.name === "ship") $("[data-addr-wrap]", form).hidden = !needsAddr(e.target.value);
      if (e.target.getAttribute("aria-invalid") === "true") validateField(e.target);
    });
    form.addEventListener("change", function (e) { if (e.target.name === "ship") { d.ship = e.target.value; $("[data-addr-wrap]", form).hidden = !needsAddr(d.ship); } });
  }
  function shipOpt(id) { return D.site.ship.filter(function (s) { return s.id === id; })[0] || D.site.ship[0]; }
  function needsAddr(id) { return !!shipOpt(id).addr; }
  var checkoutDraft = null;
  function opt(name, value, title, desc, ic, checked) {
    return '<label class="opt opt--mini"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? " checked" : "") + '>' +
      '<span class="opt__card"><span class="opt__ic">' + icon(ic) + '</span><span class="opt__t">' + esc(title) + '</span><span class="opt__d">' + esc(desc) + "</span></span></label>";
  }
  function field(name, label, control, hint) {
    return '<div class="field" data-field="' + name + '"><label>' + esc(label) + "</label>" + control.replace("<input ", '<input aria-describedby="err-' + name + '" ').replace("<textarea ", '<textarea aria-describedby="err-' + name + '" ') +
      (hint ? "<small>" + hint + "</small>" : "") + '<p class="err" id="err-' + name + '" hidden></p></div>';
  }
  function setErr(input, msg) {
    var f = input.closest(".field"), p = f && $(".err", f);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
    return !msg;
  }
  function validateField(input) {
    var v = input.value.trim();
    if (input.name === "name") return setErr(input, v.length < 2 ? "نام و نام خانوادگی را بنویس." : "");
    if (input.name === "phone") return setErr(input, !v ? "شماره‌ی موبایل را بنویس." : (phoneOk(v) ? "" : "شماره‌ی موبایل باید ۱۱ رقم و با ۰۹ شروع شود."));
    if (input.name === "addr") return setErr(input, v.length < 10 ? "آدرس را کامل‌تر بنویس تا بسته درست برسد." : "");
    return true;
  }
  function placeOrder() {
    var form = $("[data-checkout-form]", cartEl);
    var fields = ["name", "phone"].concat(needsAddr(checkoutDraft.ship) ? ["addr"] : []);
    var bad = null;
    fields.forEach(function (n) { var el = form.elements[n]; if (!validateField(el) && !bad) bad = el; });
    if (bad) { bad.focus(); return; }
    var t = store.totals();
    var o = {
      id: "o" + Date.now(), code: "PP-" + uid(5), phone: phoneNorm(checkoutDraft.phone), name: checkoutDraft.name.trim(),
      ship: checkoutDraft.ship, addr: needsAddr(checkoutDraft.ship) ? checkoutDraft.addr.trim() : "", note: checkoutDraft.note.trim(),
      items: store.cart().map(function (l) { return { id: l.id, v: l.v, qty: l.qty, price: byId[l.id].price }; }),
      total: t.total, off: t.off, created: Date.now(), status: "pending"
    };
    store.addOrder(o);
    var u = store.user();
    if (u && !u.name && o.name) store.updateUser({ name: o.name });
    checkoutDraft = null;
    cartView = "done";
    store.clearCart();
    var body = $("[data-cart-body]", cartEl), foot = $("[data-cart-foot]", cartEl);
    $("#cart-title").textContent = "سفارش ثبت شد";
    body.innerHTML = '<div class="done"><span class="done__badge">' + icon("check") + "</span><h2>سفارشت ثبت شد</h2>" +
      '<p class="done__code">کد سفارش <b dir="ltr">' + o.code + "</b></p>" +
      "<p style=\"color:var(--ink-2);font-size:14.5px\">" + (needsAddr(o.ship) ? shipOpt(o.ship).name + "، " + shipOpt(o.ship).when + ". برای هماهنگی ارسال و پرداخت با شماره‌ی " + ltr(phoneShow(o.phone)) + " تماس گرفته می‌شود." : "سفارشت در فروشگاه آماده می‌شود؛ هنگام تحویل کد سفارش را بگو.") + "</p>" +
      (DEMO ? '<p class="note note--demo" style="text-align:right">' + icon("info") + "<span>نسخه‌ی نمایشی: این سفارش فقط در همین مرورگر ذخیره شد.</span></p>" : "") + "</div>";
    foot.innerHTML = '<div style="display:grid;gap:10px"><a class="btn btn--block" href="' + ROOT + 'profile/#orders">مشاهده در سفارش‌های من</a><button class="btn btn--ghost btn--block" type="button" data-close>ادامه‌ی خرید</button></div>';
  }
  function openCart() { cartView = "cart"; renderCart(); Layers.open(cartEl); }
  if (cartEl) {
    cartEl.addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-line-inc]"))) { var l = findLine(b.dataset.lineInc); if (l) store.setQty(b.dataset.lineInc, l.qty + 1); }
      else if ((b = e.target.closest("[data-line-dec]"))) { var l2 = findLine(b.dataset.lineDec); if (l2) store.setQty(b.dataset.lineDec, l2.qty - 1); }
      else if ((b = e.target.closest("[data-line-rm]"))) { store.remove(b.dataset.lineRm); focusCart(); }
      else if (e.target.closest("[data-checkout]")) { cartView = "checkout"; renderCart(); var f = $("[data-cart-body] input[name=name]", cartEl); if (f && !f.value) f.focus(); else $(".drawer__panel", cartEl).focus(); }
      else if (e.target.closest("[data-back-cart]")) { cartView = "cart"; renderCart(); $(".drawer__panel", cartEl).focus(); }
      else if (e.target.closest("[data-place-order]")) { placeOrder(); }
    });
    cartEl.addEventListener("layer:close", function () { if (cartView === "done") cartView = "cart"; });
  }
  function findLine(key) { return store.cart().filter(function (l) { return lineKey(l.id, l.v) === key; })[0]; }
  function focusCart() { setTimeout(function () { var p = $(".drawer__panel", cartEl); if (p && !p.contains(document.activeElement)) p.focus(); }, 0); }

  // ------------------------------------------------------------ search
  var searchEl = $("#search");
  var POPULAR = ["ضد آفتاب", "میسلار", "ریمل", "بادی اسپلش", "نیاسینامید", "رژ لب", "شامپو"];
  function renderSearch(q) {
    var body = $("[data-search-body]", searchEl);
    var n = norm(q);
    if (!n) {
      body.innerHTML = '<p class="search__h">جستجوهای پرطرفدار</p><ul class="chips">' +
        POPULAR.map(function (w) { return '<li><button class="chip" type="button" data-suggest="' + esc(w) + '">' + icon("search") + esc(w) + "</button></li>"; }).join("") + "</ul>" +
        '<p class="search__h">دسته‌بندی‌ها</p><ul class="chips">' +
        D.cats.map(function (c) { return '<li><a class="chip" href="' + ROOT + "products/?cat=" + c.id + '">' + esc(c.name) + "</a></li>"; }).join("") + "</ul>";
      return;
    }
    var res = P.filter(function (p) { return matchQ(p, q); }).sort(function (a, b) { return (b.stock > 0) - (a.stock > 0) || a.rank - b.rank; });
    var brands = D.brands.filter(function (b) { return norm(b.en + " " + b.fa).indexOf(n) > -1 && P.some(function (p) { return p.brand === b.id; }); });
    var cats = D.cats.filter(function (c) { return norm(c.name).indexOf(n) > -1; });
    if (!res.length && !brands.length && !cats.length) {
      body.innerHTML = '<div class="search__empty"><p>برای «' + esc(q) + '» چیزی پیدا نشد.</p><p style="font-size:14px;color:var(--mist);margin-top:6px">املای کلمه را بررسی کن یا نام برند را انگلیسی بنویس.</p></div>';
      return;
    }
    var h = "";
    if (cats.length || brands.length) {
      h += '<ul class="chips" style="margin-bottom:8px">' +
        cats.map(function (c) { return '<li><a class="chip" href="' + ROOT + "products/?cat=" + c.id + '">' + esc(c.name) + "</a></li>"; }).join("") +
        brands.map(function (b) { return '<li><a class="chip" href="' + ROOT + "products/?brand=" + b.id + '"><span class="lat" dir="ltr">' + esc(b.en) + "</span></a></li>"; }).join("") + "</ul>";
    }
    if (res.length) {
      h += '<p class="search__h">محصولات</p><div class="sres">' + res.slice(0, 6).map(function (p) {
        return '<a href="' + url(p) + '"><span class="sres__img"><img src="' + img(p) + '" alt=""></span>' +
          '<span class="sres__t"><b>' + rich(p.name) + '</b><span class="lat">' + esc(BRAND[p.brand].en) + "</span></span>" +
          (p.stock > 0 ? '<span class="price"><b>' + fmt(p.price) + "</b></span>" : '<span class="card__out" style="font-size:13px">ناموجود</span>') + "</a>";
      }).join("") + "</div>";
      h += '<div class="search__all"><a class="btn btn--ghost btn--sm" href="' + ROOT + "products/?q=" + encodeURIComponent(q.trim()) + '">مشاهده‌ی همه‌ی ' + res.length + " نتیجه" + icon("chev-l") + "</a></div>";
    }
    body.innerHTML = h;
  }
  function openSearch() {
    var input = $("[data-search-input]", searchEl);
    renderSearch(input.value);
    Layers.open(searchEl, "[data-search-input]");
  }
  if (searchEl) {
    var input = $("[data-search-input]", searchEl);
    input.addEventListener("input", debounce(function () { renderSearch(input.value); }, 110));
    $("[data-search-form]", searchEl).addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      Layers.closeAll().then(function () { location.assign(ROOT + "products/?q=" + encodeURIComponent(q)); });
    });
    searchEl.addEventListener("click", function (e) {
      var s = e.target.closest("[data-suggest]");
      if (s) { input.value = s.dataset.suggest; renderSearch(input.value); input.focus(); }
    });
  }

  // ------------------------------------------------------------ header: mega menu
  $$("[data-mega]").forEach(function (drop) {
    var btn = $(".nav__caret", drop);
    function set(on) { drop.classList.toggle("is-open", on); btn.setAttribute("aria-expanded", on ? "true" : "false"); }
    btn.addEventListener("click", function () { set(!drop.classList.contains("is-open")); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Escape" && drop.classList.contains("is-open")) { set(false); btn.focus(); } });
    drop.addEventListener("focusout", function (e) { if (!drop.contains(e.relatedTarget)) set(false); });
    document.addEventListener("click", function (e) { if (!drop.contains(e.target)) set(false); });
  });

  // ------------------------------------------------------------ rails
  function initRail(rail) {
    var track = $(".rail__track", rail), prev = $("[data-rail-prev]", rail), next = $("[data-rail-next]", rail);
    if (!track) return;
    function state() {
      var max = track.scrollWidth - track.clientWidth, x = Math.abs(track.scrollLeft);
      if (prev) prev.disabled = x < 4;
      if (next) next.disabled = x > max - 4 || max <= 4;
    }
    function go(dir) { track.scrollBy({ left: dir * -1 * track.clientWidth * 0.92, behavior: "smooth" }); }
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("scroll", debounce(state, 60), { passive: true });
    window.addEventListener("resize", debounce(state, 120));
    rail.refresh = function () { track.scrollLeft = 0; state(); };
    state();
  }

  // ------------------------------------------------------------ calendar file for a booking
  /* Tehran is UTC+3:30 all year, so the event is written in UTC — every
     calendar app then shows it at the right local time. */
  function ics(b) {
    var p = parseISO(b.date), t = D.consult.types.filter(function (x) { return x.id === b.type; })[0] || { name: "مشاوره", min: 30 };
    var start = new Date(Date.UTC(p.y, p.m - 1, p.d, 0, toMin(b.time) - 210));
    var end = new Date(start.getTime() + (b.min || t.min) * 60000);
    function f(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    function e(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
    function fold(line) {
      var enc = new TextEncoder(), out = "", cur = "", n = 0;
      Array.from(line).forEach(function (ch) {
        var w = enc.encode(ch).length;
        if (n + w > 73) { out += cur + "\r\n "; cur = ""; n = 1; }
        cur += ch; n += w;
      });
      return out + cur;
    }
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SamCosmetics//Booking//FA", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      "UID:" + b.id + "@samcosmetics", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start), "DTEND:" + f(end),
      "SUMMARY:" + e("مشاوره‌ی آرایشی سام: " + t.name),
      b.mode === "store" ? "LOCATION:" + e(D.site.name + "، " + D.site.address) : "",
      "DESCRIPTION:" + e("کد نوبت: " + b.code + "\n" + (b.mode === "online" ? "مشاوره‌ی آنلاین در بله" : "حضوری در فروشگاه") + "\nتلفن فروشگاه: " + D.site.phone),
      "END:VEVENT", "END:VCALENDAR"].filter(Boolean).map(fold).join("\r\n") + "\r\n";
  }
  function downloadICS(b) {
    if (!b) return;
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics(b)], { type: "text/calendar;charset=utf-8" }));
    a.download = "sam-" + b.code + ".ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // ------------------------------------------------------------ global wiring
  function syncChrome() {
    var n = store.cartCount();
    $$("[data-cart-count]").forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n); });
    var f = S.favs.length;
    $$("[data-fav-count]").forEach(function (b) { b.hidden = !f; });
    $$("[data-open-cart]").forEach(function (b) { if (b.classList.contains("iconbtn")) b.setAttribute("aria-label", n ? "سبد خرید، " + n + " کالا" : "سبد خرید"); });
    $$("[data-fav]").forEach(function (b) {
      var on = store.isFav(b.getAttribute("data-fav"));
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var p = byId[b.getAttribute("data-fav")];
      b.setAttribute("aria-label", (on ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها") + (p ? ": " + plain(p.name) : ""));
    });
    if (cartEl && Layers.isOpen(cartEl) && cartView === "cart") renderCart();
  }
  document.addEventListener("store", syncChrome);

  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-fav]"))) {
      e.preventDefault();
      var on = store.toggleFav(b.getAttribute("data-fav"));
      toast(on ? "به علاقه‌مندی‌ها اضافه شد" : "از علاقه‌مندی‌ها حذف شد", on ? { icon: "heart", action: { label: "مشاهده", href: ROOT + "profile/#favorites" } } : { icon: "heart" });
      return;
    }
    if ((b = e.target.closest("[data-quick-add]"))) { e.preventDefault(); quickAdd(b.getAttribute("data-quick-add"), b); return; }
    if ((b = e.target.closest("[data-open-cart]"))) { e.preventDefault(); if (!Layers.isOpen(cartEl)) openCart(); return; }
    if ((b = e.target.closest("[data-open-search]"))) { e.preventDefault(); openSearch(); return; }
    if ((b = e.target.closest("[data-close]"))) {
      var layer = b.closest(".layer");
      if (layer) { e.preventDefault(); Layers.close(layer); }
    }
  });
  // "/" opens search on desktop, like most shops
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !Layers.any() && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault(); openSearch();
    }
  });
  // iOS only paints :active when the document listens for touches
  document.addEventListener("touchstart", function () {}, { passive: true });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { S = load(); syncChrome(); } });

  syncChrome();

  // ------------------------------------------------------------ phone tab bar: the active pill slides in from the last tab
  (function () {
    var bar = $(".tabbar");
    if (!bar) return;
    var i = Number(bar.getAttribute("data-tab-i"));
    var prev = null;
    try { prev = sessionStorage.getItem("sam-tab"); sessionStorage.setItem("sam-tab", String(i)); } catch (e) { /* fine */ }
    if (i < 0) { bar.classList.add("is-none"); return; }
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prev !== null && Number(prev) >= 0 && Number(prev) !== i && !reduce) {
      bar.style.setProperty("--i", prev);
      void bar.offsetWidth;
      requestAnimationFrame(function () { bar.classList.add("is-ready"); bar.style.setProperty("--i", i); });
    } else {
      bar.classList.add("is-ready");
    }
    $$(".tab", bar).forEach(function (t, k) {
      t.addEventListener("click", function () { bar.classList.remove("is-none"); bar.style.setProperty("--i", k); });
    });
  })();

  // ------------------------------------------------------------ home-screen app: service worker + first-visit popups
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } }
  var CK = "sam.consent", A2 = "sam.a2hs";
  function consent() { try { return JSON.parse(lsGet(CK) || "null"); } catch (e) { return null; } }
  var UA = navigator.userAgent || "";
  var STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  var INAPP = /Instagram|FBAN|FBAV|Line\//i.test(UA);
  var PHONE = IOS || /Android/i.test(UA) || (matchMedia("(pointer: coarse)").matches && innerWidth < 900);
  function regSW() { if ("serviceWorker" in navigator) navigator.serviceWorker.register(ROOT + "sw.js").catch(function () { /* fine without */ }); }
  if (document.readyState === "complete") regSW(); else window.addEventListener("load", regSW);

  var installEvt = null;   // Chrome's own install prompt, saved for our button
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; if ($("#pop-a2")) fillInstall($("#pop-a2")); });
  window.addEventListener("appinstalled", function () { lsSet(A2, "installed"); hidePop("a2"); });
  function pop(id, html) {
    var el = document.createElement("section");
    el.className = "pop";
    el.id = "pop-" + id;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "pop-" + id + "-t");
    el.innerHTML = html;
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add("is-in");
    return el;
  }
  function hidePop(id) {
    var el = $("#pop-" + id); if (!el) return;
    el.classList.remove("is-in");
    setTimeout(function () { el.remove(); }, 320);
  }
  function askConsent(then) {
    var el = pop("ck",
      '<span class="pop__ic">' + icon("cookie") + '</span><div class="pop__body"><h2 id="pop-ck-t">اجازه‌ی کوکی</h2>' +
      "<p>با اجازه‌ات یک کوکی ساده ذخیره می‌کنیم تا سبد خرید و علاقه‌مندی‌هایت یادمان بماند و آمار کلی بازدید (بدون نام و شماره) ثبت شود. " +
      '<a href="' + ROOT + 'privacy/">بیشتر بخوان</a></p>' +
      '<div class="pop__acts"><button class="btn btn--sm" type="button" data-ck="1">پذیرفتن</button><button class="btn btn--ghost btn--sm" type="button" data-ck="0">فقط ضروری</button></div></div>');
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ck]"); if (!b) return;
      lsSet(CK, JSON.stringify({ ok: b.dataset.ck === "1", at: Date.now() }));
      hidePop("ck");
      if (then) setTimeout(then, 800);
    });
  }
  function wantsInstall() {
    if (STANDALONE || !PHONE) return false;
    var v = lsGet(A2) || "";
    if (v === "installed" || v === "done") return false;
    return !(v.indexOf("later:") === 0 && Date.now() - Number(v.slice(6)) < 7 * 864e5);
  }
  function step(html) { return "<li><span>" + html + "</span></li>"; }
  function fillInstall(el) {
    var how, main = "";
    if (installEvt) {
      how = "";
      main = '<button class="btn btn--sm" type="button" data-a2="go">' + icon("addsq") + "افزودن به صفحه‌ی اصلی</button>";
    } else if (INAPP) {
      how = '<ol class="pop__steps">' + step("از منوی " + icon("dots") + " بالای صفحه، «<bdi class='lat' dir='ltr'>Open in browser</bdi>» یا «باز کردن در مرورگر» را بزن.") +
        step(IOS ? "در سافاری، دکمه‌ی اشتراک‌گذاری " + icon("share") + " و بعد «<bdi class='lat' dir='ltr'>Add to Home Screen</bdi>» را بزن." : "در کروم، از منوی " + icon("dots") + " گزینه‌ی «<bdi class='lat' dir='ltr'>Add to Home screen</bdi>» را بزن.") + "</ol>";
    } else if (IOS) {
      how = '<ol class="pop__steps">' + step("دکمه‌ی اشتراک‌گذاری " + icon("share") + " را در نوار مرورگر بزن.") +
        step("«<bdi class='lat' dir='ltr'>Add to Home Screen</bdi>» " + icon("addsq") + " یا «افزودن به صفحه‌ی اصلی» را انتخاب کن.") + step("بالای صفحه «<bdi class='lat' dir='ltr'>Add</bdi>» را بزن.") + "</ol>";
    } else {
      how = '<ol class="pop__steps">' + step("منوی مرورگر " + icon("dots") + " را بزن.") +
        step("«<bdi class='lat' dir='ltr'>Add to Home screen</bdi>»، «<bdi class='lat' dir='ltr'>Install app</bdi>» یا «افزودن به صفحه‌ی اصلی» را انتخاب کن.") + "</ol>";
    }
    el.innerHTML = '<img class="pop__app" src="' + ROOT + 'assets/brand/apple-touch-icon.png" alt="" width="56" height="56">' +
      '<div class="pop__body"><h2 id="pop-a2-t">آرایشی سام روی صفحه‌ی گوشی‌ات</h2>' +
      "<p>سایت را به صفحه‌ی اصلی گوشی اضافه کن تا مثل یک اپ با یک لمس باز شود؛ بدون نصب از فروشگاه و تقریباً بدون حافظه.</p>" + how +
      '<div class="pop__acts">' + (main || '<button class="btn btn--sm" type="button" data-a2="done">' + icon("check") + "اضافه کردم</button>") +
      '<button class="btn btn--ghost btn--sm" type="button" data-a2="later">بعداً</button></div></div>' +
      '<button class="iconbtn pop__x" type="button" data-a2="later" aria-label="بستن">' + icon("x") + "</button>";
  }
  function askInstall() {
    var el = pop("a2", "");
    fillInstall(el);
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a2]"); if (!b) return;
      var act = b.dataset.a2;
      if (act === "go" && installEvt) {
        var ev = installEvt;
        installEvt = null;
        ev.prompt();
        ev.userChoice.then(function (c) { lsSet(A2, c && c.outcome === "accepted" ? "installed" : "later:" + Date.now()); }, function () {});
      } else if (act === "done") {
        lsSet(A2, "done");
        toast("عالی! از این به بعد آرایشی سام روی صفحه‌ی گوشی‌ات است.");
      } else {
        lsSet(A2, "later:" + Date.now());
      }
      hidePop("a2");
    });
  }
  if (!navigator.webdriver) setTimeout(function () {
    if (!consent()) askConsent(function () { if (wantsInstall()) askInstall(); });
    else if (wantsInstall()) askInstall();
  }, document.documentElement.classList.contains("intro-off") || !$(".intro") ? 1000 : 2700);

  window.PP = {
    D: D, ROOT: ROOT, DEMO: DEMO, $: $, $$: $$, esc: esc, rich: rich, plain: plain, fmt: fmt, toLatin: toLatin, norm: norm,
    debounce: debounce, icon: icon, uid: uid, ltr: ltr, phoneNorm: phoneNorm, phoneOk: phoneOk, phoneShow: phoneShow,
    g2j: g2j, j2g: j2g, jLen: jLen, MONTHS: MONTHS, WEEK: WEEK, iso: iso, parseISO: parseISO, weekday: weekday, addDays: addDays,
    faDate: faDate, faDay: faDay, tehranNow: tehranNow, hm: hm, toMin: toMin,
    P: P, byId: byId, CAT: CAT, SUB: SUB, BRAND: BRAND, SKIN: SKIN, CONCERN: CONCERN, matchQ: matchQ, img: img, url: url,
    store: store, card: card, skeletons: skeletons, priceHTML: priceHTML, toast: toast, Layers: Layers,
    quickAdd: quickAdd, addToCart: addToCart, openCart: openCart, openSearch: openSearch, initRail: initRail,
    field: field, opt: opt, setErr: setErr, validateField: validateField, ics: ics, downloadICS: downloadICS
  };
})();
