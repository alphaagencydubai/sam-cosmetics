/* Booking — four steps (type → time → info → review) and a confirmation.
   Each step owns a history entry, so the back gesture walks the steps backwards.
   The draft survives a reload (sessionStorage). Slots come from the shop's hours
   in data/catalog.py; "taken" slots are seeded from the date so the diary never
   reshuffles between visits, and slots booked in this browser are marked yours. */
(function () {
  "use strict";
  var PP = window.PP, $ = PP.$, $$ = PP.$$, esc = PP.esc, icon = PP.icon;
  var box = $("[data-booking]");
  if (!box) return;
  var main = $("[data-book-main]"), side = $("[data-book-side]"), stepper = $("[data-stepper]");
  var C = PP.D.consult, SITE = PP.D.site;
  var TYPES = {}, MODES = {};
  C.types.forEach(function (t) { TYPES[t.id] = t; });
  C.modes.forEach(function (m) { MODES[m.id] = m; });
  var TYPE_IC = { skin: "face", makeup: "lipstick", scent: "perfume", hair: "wave" };
  var MODE_IC = { store: "store", online: "chat" };
  var STEPS = ["type", "time", "info", "review"];
  var KEY = "sam.booking", LAST = "sam.booking.last";

  function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } }
  var st = load() || { type: "", mode: "", date: "", time: "", name: "", phone: "", skin: "", note: "" };
  var qp = new URLSearchParams(location.search).get("type");
  if (qp && TYPES[qp] && !st.type) st.type = qp;
  var u = PP.store.user();
  if (u) { if (!st.name) st.name = u.name || ""; if (!st.phone) st.phone = u.phone; if (!st.skin) st.skin = u.skin || ""; }
  fixMode();

  // ------------------------------------------------------------ slots
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mine(date, time) { return PP.store.allBookings().some(function (b) { return b.status === "booked" && b.date === date && b.time === time; }); }
  function slotsFor(date) {
    if (C.hours.closed.indexOf(PP.weekday(date)) > -1) return null;
    var dur = st.type ? TYPES[st.type].min : 30, now = PP.tehranNow(), out = [];
    C.hours.open.forEach(function (r) {
      var a = PP.toMin(r[0]), b = PP.toMin(r[1]);
      for (var t = a; t + dur <= b; t += C.step) {
        if (date === now.date && t < now.min + C.notice) continue;
        if (date < now.date) continue;
        var time = PP.hm(t);
        out.push({ time: time, min: t, state: mine(date, time) ? "mine" : (hash(date + "|" + time) % 100 < 30 ? "taken" : "free") });
      }
    });
    return out;
  }
  function free(date, time) { var s = slotsFor(date); return !!s && s.some(function (x) { return x.time === time && x.state === "free"; }); }
  function days() {
    var now = PP.tehranNow(), out = [];
    for (var i = 0; i < C.days; i++) {
      var d = PP.addDays(now.date, i), s = slotsFor(d);
      out.push({ date: d, i: i, closed: s === null, full: !!s && !s.some(function (x) { return x.state === "free"; }) });
    }
    return out;
  }

  // ------------------------------------------------------------ rules
  function fixMode() {
    if (!st.type) return;
    var ok = TYPES[st.type].modes;
    if (st.mode && ok.indexOf(st.mode) < 0) st.mode = "";
    if (!st.mode && ok.length === 1) st.mode = ok[0];
  }
  function nameOk(v) { return String(v || "").trim().length >= 2; }
  function can(s) {
    if (s === "type") return true;
    if (s === "time") return !!(st.type && st.mode);
    if (s === "info") return can("time") && !!(st.date && st.time && free(st.date, st.time));
    if (s === "review") return can("info") && nameOk(st.name) && PP.phoneOk(st.phone);
    return false;
  }
  function clamp(s) { var i = Math.max(0, STEPS.indexOf(s)); while (i > 0 && !can(STEPS[i])) i--; return STEPS[i]; }

  // ------------------------------------------------------------ views
  function durLabel(t) { return t.min + " دقیقه"; }
  function dayLabel(d) { return d.i === 0 ? "امروز" : (d.i === 1 ? "فردا" : PP.WEEK[PP.weekday(d.date)]); }
  function when(date, time) { return PP.faDate(date, true) + "، ساعت " + time; }
  function foot(prev, nextLabel, attr) {
    return '<div class="book__foot">' + (prev ? '<button class="btn btn--ghost" type="button" data-prev>بازگشت</button>' : "") +
      '<button class="btn" type="button" ' + (attr || "data-next") + ">" + nextLabel + "</button></div>";
  }
  function vType() {
    var t = st.type ? TYPES[st.type] : null;
    return '<div class="bstep"><h2 tabindex="-1">چه نوع مشاوره‌ای می‌خواهی؟</h2><p>مشاوره ' + esc(C.price) + " است؛ فقط موضوع و وقتش را انتخاب کن.</p>" +
      '<div class="opts opts--2" role="radiogroup" aria-label="نوع مشاوره">' + C.types.map(function (x) {
        return '<label class="opt"><input type="radio" name="type" value="' + x.id + '"' + (st.type === x.id ? " checked" : "") + ">" +
          '<span class="opt__card"><span class="opt__ic">' + icon(TYPE_IC[x.id] || "sparkle") + '</span><span class="opt__t">' + esc(x.name) + '</span><span class="opt__m">' + durLabel(x) + '</span><span class="opt__d">' + esc(x.desc) + "</span></span></label>";
      }).join("") + "</div>" +
      "<h3>به چه صورت؟</h3>" +
      '<div class="opts opts--2" role="radiogroup" aria-label="نحوه‌ی مشاوره">' + C.modes.map(function (m) {
        var off = t && t.modes.indexOf(m.id) < 0;
        return '<label class="opt opt--mini"><input type="radio" name="mode" value="' + m.id + '"' + (st.mode === m.id ? " checked" : "") + (off ? " disabled" : "") + ">" +
          '<span class="opt__card"><span class="opt__ic">' + icon(MODE_IC[m.id]) + '</span><span class="opt__t">' + esc(m.name) + '</span><span class="opt__d">' + esc(off ? "برای این نوع مشاوره فقط حضوری" : m.desc) + "</span></span></label>";
      }).join("") + "</div>" +
      foot(false, "ادامه: انتخاب زمان" + icon("chev-l"), "data-next" + (can("time") ? "" : " disabled")) + "</div>";
  }
  function vDays() {
    return days().map(function (d) {
      var f = PP.faDay(d.date), dis = d.closed || d.full;
      return '<button class="day" type="button" data-day="' + d.date + '" aria-pressed="' + (st.date === d.date) + '"' + (dis ? " disabled" : "") +
        ' aria-label="' + esc(dayLabel(d) + " " + f.d + " " + f.m + (d.closed ? "، تعطیل" : d.full ? "، تکمیل" : "")) + '">' +
        '<span class="day__w">' + esc(dayLabel(d)) + '</span><span class="day__d">' + f.d + '</span><span class="day__m">' + (d.closed ? "تعطیل" : d.full ? "تکمیل" : esc(f.m)) + "</span></button>";
    }).join("");
  }
  function vSlots() {
    if (!st.date) return '<p class="note">' + icon("calendar") + "<span>اول روز را انتخاب کن تا ساعت‌های خالی را ببینی.</span></p>";
    var s = slotsFor(st.date);
    if (!s || !s.some(function (x) { return x.state === "free"; })) return '<p class="note">' + icon("info") + "<span>برای این روز وقت خالی نمانده؛ روز دیگری را انتخاب کن.</span></p>";
    function grp(title, arr) {
      if (!arr.length) return "";
      return "<h4>" + title + '</h4><div class="slots__grid">' + arr.map(function (x) {
        if (x.state === "mine") return '<button class="slot is-mine" type="button" disabled aria-label="' + x.time + '، نوبت خودت">نوبت تو</button>';
        if (x.state === "taken") return '<button class="slot" type="button" disabled aria-label="' + x.time + '، رزرو شده">' + x.time + "</button>";
        return '<button class="slot" type="button" data-time="' + x.time + '" aria-pressed="' + (st.time === x.time) + '">' + x.time + "</button>";
      }).join("") + "</div>";
    }
    return grp("صبح", s.filter(function (x) { return x.min < 14 * 60; })) + grp("عصر", s.filter(function (x) { return x.min >= 14 * 60; }));
  }
  function vTime() {
    var t = TYPES[st.type], m = MODES[st.mode];
    if (!st.date) { var first = days().filter(function (d) { return !d.closed && !d.full; })[0]; if (first) st.date = first.date; }
    return '<div class="bstep"><h2 tabindex="-1">روز و ساعت</h2><p>' + esc(t.name) + "، " + durLabel(t) + "، " + esc(m.name) + "</p>" +
      '<div class="days" role="group" aria-label="انتخاب روز" data-days>' + vDays() + "</div>" +
      '<div class="slots" role="group" aria-label="انتخاب ساعت" data-slots>' + vSlots() + "</div>" +
      foot(true, "ادامه" + icon("chev-l"), "data-next" + (st.time && free(st.date, st.time) ? "" : " disabled")) + "</div>";
  }
  function vInfo() {
    var skinQ = st.type === "skin" || st.type === "makeup";
    return '<div class="bstep"><h2 tabindex="-1">اطلاعات تماس</h2><p>برای هماهنگی نوبت با تو.</p>' +
      '<form class="form" data-info novalidate onsubmit="return false">' +
        PP.field("name", "نام و نام خانوادگی", '<input class="input" name="name" autocomplete="name" value="' + esc(st.name) + '" required>') +
        PP.field("phone", "شماره‌ی موبایل", '<input class="input input--ltr" name="phone" inputmode="numeric" autocomplete="tel" dir="ltr" placeholder="0912 345 6789" value="' + esc(st.phone) + '" required>') +
        (skinQ ? '<div class="field"><span class="lbl">نوع پوستت (اگر می‌دانی)</span><div class="chips" role="group" aria-label="نوع پوست">' +
          PP.D.skin.map(function (s) { return '<button class="chip" type="button" data-skin="' + s.id + '" aria-pressed="' + (st.skin === s.id) + '">' + esc(s.name) + "</button>"; }).join("") +
          '<button class="chip" type="button" data-skin="" aria-pressed="' + (!st.skin) + '">نمی‌دانم</button></div></div>' : "") +
        PP.field("note", "توضیحات (اختیاری)", '<textarea class="textarea" name="note" rows="3" maxlength="300" placeholder="مثلاً حساسیت پوستی یا محصولی که الان استفاده می‌کنی">' + esc(st.note) + "</textarea>") +
      "</form>" + foot(true, "ادامه: مرور نوبت" + icon("chev-l")) + "</div>";
  }
  function reviewList(b, edit) {
    var t = TYPES[b.type], m = MODES[b.mode];
    function row(k, v, go) { return "<div><dt>" + k + "</dt><dd>" + v + "</dd>" + (edit && go ? '<button class="linkbtn" type="button" data-goto="' + go + '">ویرایش</button>' : "<span></span>") + "</div>"; }
    return '<dl class="review">' +
      row("مشاوره", esc(t.name), "type") +
      row("نحوه", esc(m.name), "type") +
      row("زمان", esc(when(b.date, b.time)), "time") +
      row("مدت", durLabel(t), null) +
      row("نام", esc(b.name), "info") +
      row("موبایل", PP.ltr(PP.phoneShow(b.phone)), "info") +
      (b.skin ? row("نوع پوست", esc(PP.SKIN[b.skin].name), "info") : "") +
      (b.note ? row("توضیحات", esc(b.note), "info") : "") + "</dl>";
  }
  function where(b) {
    return b.mode === "store"
      ? "آدرس فروشگاه: " + esc(SITE.address) + ". اگر برنامه‌ات عوض شد، نوبت را از پروفایل لغو کن تا وقت برای نفر بعدی آزاد شود."
      : "در زمان نوبت، کارشناس سام در پیام‌رسان بله با شماره‌ی " + PP.ltr(PP.phoneShow(b.phone)) + " تماس می‌گیرد؛ بله‌ات روی همین شماره باشد.";
  }
  function vReview() {
    return '<div class="bstep"><h2 tabindex="-1">مرور و تأیید</h2><p>اگر همه‌چیز درست است، نوبت را ثبت کن.</p>' + reviewList(st, true) +
      '<p class="note" style="margin-top:16px">' + icon(st.mode === "store" ? "pin" : "chat") + "<span>" + where(st) + "</span></p>" +
      (PP.DEMO ? '<p class="note note--demo" style="margin-top:10px">' + icon("info") + "<span>نسخه‌ی نمایشی: نوبت فقط در همین مرورگر ذخیره می‌شود و به فروشگاه ارسال نمی‌شود.</span></p>" : "") +
      foot(true, icon("check") + "ثبت نوبت", "data-confirm") + "</div>";
  }
  function vDone(b) {
    return '<div class="bstep done"><span class="done__badge">' + icon("check") + '</span><h2 tabindex="-1">نوبتت ثبت شد</h2>' +
      '<p class="done__code">کد نوبت <b dir="ltr">' + esc(b.code) + "</b></p>" + reviewList(b, false) +
      '<p class="note" style="max-width:520px;width:100%;text-align:right">' + icon(b.mode === "store" ? "pin" : "chat") + "<span>" + where(b) + "</span></p>" +
      '<div class="done__acts"><button class="btn" type="button" data-ics="' + b.id + '">' + icon("download") + "افزودن به تقویم</button>" +
      '<a class="btn btn--ghost" href="' + PP.ROOT + 'profile/#bookings">نوبت‌های من</a></div>' +
      '<button class="linkbtn" type="button" data-again style="margin-top:6px">رزرو یک نوبت دیگر</button></div>';
  }
  function vSide() {
    var t = st.type ? TYPES[st.type] : null, m = st.mode ? MODES[st.mode] : null;
    function r(k, v) { return "<div><dt>" + k + "</dt><dd" + (v ? "" : ' class="is-empty"') + ">" + (v || "انتخاب نشده") + "</dd></div>"; }
    return '<div class="bsum"><h2>خلاصه‌ی نوبت</h2><dl>' +
      r("مشاوره", t && esc(t.name)) + r("نحوه", m && esc(m.name)) +
      r("روز", st.date && step !== "type" ? esc(PP.faDate(st.date, true)) : "") + r("ساعت", st.time && step !== "type" ? st.time : "") +
      r("مدت", t && durLabel(t)) + r("هزینه", esc(C.price)) + "</dl></div>" +
      '<p class="note" style="margin-top:12px">' + icon("phone") + '<span>سؤال داری؟ با فروشگاه تماس بگیر: <a href="tel:+98' + SITE.phone.slice(1) + '" style="color:var(--ink);font-weight:600">' + PP.ltr(SITE.phone_display) + "</a></span></p>";
  }

  // ------------------------------------------------------------ render + history
  var step = "type", lastDone = null;
  function paintStepper() {
    var i = STEPS.indexOf(step);
    $$("[data-step-ind]", stepper).forEach(function (li, k) {
      var state = step === "done" ? "done" : (k < i ? "done" : (k === i ? "current" : "todo"));
      li.dataset.state = state;
      if (state === "current") li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }
  function render(moved) {
    paintStepper();
    if (step === "done") main.innerHTML = vDone(lastDone);
    else main.innerHTML = step === "type" ? vType() : step === "time" ? vTime() : step === "info" ? vInfo() : vReview();
    side.innerHTML = step === "done" ? "" : vSide();
    side.hidden = step === "done";
    if (moved) {
      var h = $("h2", main);
      if (h) h.focus({ preventScroll: true });
      var top = stepper.getBoundingClientRect().top + scrollY - (document.querySelector(".hdr").offsetHeight + 12);
      if (scrollY > top) window.scrollTo({ top: top, behavior: "auto" });
    }
    if (step === "time") {
      var sel = $('.day[aria-pressed="true"]', main);
      if (sel) sel.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    }
  }
  function url(s) { return location.pathname + location.search + (s === "type" ? "" : "#" + s); }
  function go(s, how, quiet) {
    step = s === "done" ? "done" : clamp(s);
    try {
      if (how === "push") history.pushState({ bstep: step }, "", url(step));
      else history.replaceState({ bstep: step }, "", url(step));
    } catch (e) { /* file:// */ }
    save();
    render(!quiet);
  }
  window.addEventListener("popstate", function (e) {
    if (e.samLayer) return;
    var s = (e.state && e.state.bstep) || (location.hash.slice(1) || "type");
    if (s === "done") { if (!lastDone) s = "type"; else { step = "done"; render(true); return; } }
    s = clamp(s);
    if (s !== step) { step = s; render(true); }
  });

  // ------------------------------------------------------------ events (bound once)
  main.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "type") { st.type = t.value; fixMode(); st.time = st.time && st.date && free(st.date, st.time) ? st.time : ""; save(); main.innerHTML = vType(); side.innerHTML = vSide(); var r = $('input[name="type"]:checked', main); if (r) r.focus(); }
    else if (t.name === "mode") { st.mode = t.value; save(); var n = $("[data-next]", main); if (n) n.disabled = !can("time"); side.innerHTML = vSide(); }
  });
  main.addEventListener("input", function (e) {
    var t = e.target;
    if (t.name === "name" || t.name === "phone" || t.name === "note") {
      st[t.name] = t.value;
      save();
      if (t.getAttribute("aria-invalid") === "true") PP.validateField(t);
    }
  });
  main.addEventListener("focusout", function (e) {
    var t = e.target;
    if ((t.name === "name" || t.name === "phone") && t.value.trim()) PP.validateField(t);
  });
  main.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-day]"))) {
      st.date = b.dataset.day;
      if (!free(st.date, st.time)) st.time = "";
      save();
      $$("[data-day]", main).forEach(function (d) { d.setAttribute("aria-pressed", d === b ? "true" : "false"); });
      $("[data-slots]", main).innerHTML = vSlots();
      $("[data-next]", main).disabled = !st.time;
      side.innerHTML = vSide();
      return;
    }
    if ((b = e.target.closest("[data-time]"))) {
      st.time = b.dataset.time;
      save();
      $$("[data-time]", main).forEach(function (d) { d.setAttribute("aria-pressed", d === b ? "true" : "false"); });
      $("[data-next]", main).disabled = false;
      side.innerHTML = vSide();
      return;
    }
    if ((b = e.target.closest("[data-skin]"))) {
      st.skin = b.dataset.skin;
      save();
      $$("[data-skin]", main).forEach(function (d) { d.setAttribute("aria-pressed", d === b ? "true" : "false"); });
      return;
    }
    if (e.target.closest("[data-prev]")) { history.back(); return; }
    if ((b = e.target.closest("[data-goto]"))) { go(b.dataset.goto, "push"); return; }
    if (e.target.closest("[data-next]")) { next(); return; }
    if (e.target.closest("[data-confirm]")) { confirm(); return; }
    if ((b = e.target.closest("[data-ics]"))) { PP.downloadICS(lastDone); return; }
    if (e.target.closest("[data-again]")) {
      lastDone = null;
      try { sessionStorage.removeItem(LAST); } catch (err) { /* ignore */ }
      st = { type: "", mode: "", date: "", time: "", name: st.name, phone: st.phone, skin: st.skin, note: "" };
      go("type", "replace");
    }
  });
  function next() {
    if (step === "info") {
      var f = $("[data-info]", main), bad = null;
      ["name", "phone"].forEach(function (n) { if (!PP.validateField(f.elements[n]) && !bad) bad = f.elements[n]; });
      if (bad) { bad.focus(); return; }
      st.name = f.elements.name.value.trim();
      st.phone = PP.phoneNorm(f.elements.phone.value);
    }
    if (step === "time" && !free(st.date, st.time)) {
      PP.toast("این ساعت همین حالا پر شد؛ ساعت دیگری را انتخاب کن.", { icon: "info" });
      st.time = ""; render(false); return;
    }
    var i = STEPS.indexOf(step);
    if (i < STEPS.length - 1 && can(STEPS[i + 1])) go(STEPS[i + 1], "push");
  }
  function confirm() {
    if (!can("review")) { go(clamp("review"), "replace"); return; }
    if (!free(st.date, st.time)) {
      PP.toast("این ساعت همین حالا پر شد؛ ساعت دیگری را انتخاب کن.", { icon: "info" });
      st.time = ""; go("time", "replace"); return;
    }
    var b = {
      id: "b" + Date.now(), code: PP.uid(5), type: st.type, mode: st.mode, date: st.date, time: st.time,
      min: TYPES[st.type].min, name: st.name.trim(), phone: PP.phoneNorm(st.phone), skin: st.skin || "",
      note: (st.note || "").trim(), status: "booked", created: Date.now()
    };
    PP.store.addBooking(b);
    var usr = PP.store.user();
    if (usr && usr.phone === b.phone) {
      var patch = {};
      if (!usr.name) patch.name = b.name;
      if (!usr.skin && b.skin) patch.skin = b.skin;
      if (Object.keys(patch).length) PP.store.updateUser(patch);
    }
    lastDone = b;
    try { sessionStorage.setItem(LAST, b.id); } catch (e) { /* ignore */ }
    st = { type: "", mode: "", date: "", time: "", name: b.name, phone: b.phone, skin: b.skin, note: "" };
    go("done", "replace");
  }

  // ------------------------------------------------------------ boot
  var h = location.hash.slice(1);
  if (h === "done") {
    var id = null;
    try { id = sessionStorage.getItem(LAST); } catch (e) { /* ignore */ }
    lastDone = PP.store.allBookings().filter(function (b) { return b.id === id; })[0] || null;
  }
  if (h === "done" && lastDone) { step = "done"; try { history.replaceState({ bstep: "done" }, "", url("done")); } catch (e) { /* ignore */ } render(false); }
  else go(STEPS.indexOf(h) > -1 ? h : "type", "replace", true);
})();
