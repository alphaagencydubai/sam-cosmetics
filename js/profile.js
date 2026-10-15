/* Profile — phone + one-time-code sign-in, then the account: overview, bookings,
   orders, favourites, skin profile, details and addresses. Sections are hash
   routes (#bookings …) so the header's heart and the booking confirmation can
   deep-link into them. All handlers are delegated from one container, bound
   once, so re-rendering a section never stacks listeners. */
(function () {
  "use strict";
  var PP = window.PP, $ = PP.$, $$ = PP.$$, esc = PP.esc, icon = PP.icon, store = PP.store;
  var box = $("[data-profile]");
  if (!box) return;
  var SITE = PP.D.site, C = PP.D.consult;
  var MARK = (($(".brand__mark") || {}).outerHTML || "").replace('class="brand__mark"', 'class="auth__mark"');
  var TABS = [
    ["overview", "پیشخوان", "home"], ["bookings", "نوبت‌ها", "calendar"], ["orders", "سفارش‌ها", "package"],
    ["favorites", "علاقه‌مندی‌ها", "heart"], ["skin", "پروفایل پوست", "face"], ["account", "اطلاعات حساب", "user"],
    ["addresses", "آدرس‌ها", "pin"]
  ];
  var TYPES = {}, MODES = {};
  C.types.forEach(function (t) { TYPES[t.id] = t; });
  C.modes.forEach(function (m) { MODES[m.id] = m; });
  var auth = { stage: "phone", phone: "", code: "", until: 0, timer: null };
  var addrEdit = null;   // null = list, "new" or an address id = editing

  function tabNow() { var h = location.hash.slice(1); return TABS.some(function (t) { return t[0] === h; }) ? h : "overview"; }

  // ------------------------------------------------------------ sign-in
  function stopTimer() { if (auth.timer) { clearInterval(auth.timer); auth.timer = null; } }
  function newCode() {
    auth.code = String(Math.floor(10000 + Math.random() * 90000));
    auth.until = Date.now() + 120000;
  }
  function renderAuth() {
    stopTimer();
    if (auth.stage === "code") {
      box.innerHTML = '<section class="auth" aria-labelledby="auth-title">' + MARK +
        '<h1 id="auth-title">کد تأیید</h1><p>' + (PP.DEMO ? "کد ۵ رقمی تأیید برای " + PP.ltr(PP.phoneShow(auth.phone)) + " را وارد کن." : "کد ۵ رقمی که به " + PP.ltr(PP.phoneShow(auth.phone)) + " پیامک شد را وارد کن.") + "</p>" +
        (PP.DEMO ? '<p class="note note--demo" style="text-align:right;margin:-8px 0 18px">' + icon("info") + "<span>نسخه‌ی نمایشی: پیامکی ارسال نمی‌شود. کد تأیید: <b dir=\"ltr\">" + auth.code + "</b></span></p>" : "") +
        '<form data-code-form novalidate>' +
          '<div class="field otp"><label for="otp">کد تأیید</label><input id="otp" class="input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="5" dir="ltr" aria-describedby="err-code" required><p class="err" id="err-code" hidden></p></div>' +
          '<button class="btn btn--block" type="submit">ورود</button>' +
          '<div class="auth__meta"><button class="linkbtn" type="button" data-edit-phone>ویرایش شماره</button><span data-timer></span></div>' +
        "</form></section>";
      tick();
      auth.timer = setInterval(tick, 1000);
      focusSoon("#otp");
      return;
    }
    box.innerHTML = '<section class="auth" aria-labelledby="auth-title">' + MARK +
      '<h1 id="auth-title">ورود یا ثبت‌نام</h1><p>با شماره‌ی موبایلت وارد شو تا نوبت‌ها، سفارش‌ها و علاقه‌مندی‌هایت یک‌جا کنار هم باشد.</p>' +
      '<form data-phone-form novalidate>' +
        PP.field("phone", "شماره‌ی موبایل", '<input class="input input--ltr" name="phone" inputmode="numeric" autocomplete="tel" dir="ltr" placeholder="0912 345 6789" value="' + esc(auth.phone) + '" required>') +
        '<button class="btn btn--block" type="submit">دریافت کد تأیید</button>' +
      "</form>" +
      '<p class="auth__legal">اگر حساب نداری، با همین شماره ساخته می‌شود.</p></section>';
  }
  function tick() {
    var el = $("[data-timer]", box);
    if (!el) { stopTimer(); return; }
    var s = Math.max(0, Math.round((auth.until - Date.now()) / 1000));
    if (s > 0) el.innerHTML = "ارسال دوباره تا " + PP.ltr(Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));
    else { el.innerHTML = '<button class="linkbtn" type="button" data-resend>ارسال دوباره‌ی کد</button>'; stopTimer(); }
  }
  function renderWelcome() {
    box.innerHTML = '<section class="auth" aria-labelledby="auth-title">' + MARK +
      '<h1 id="auth-title">به آرایشی سام خوش آمدی</h1><p>اسمت را بنویس تا نوبت‌ها و سفارش‌ها به نام خودت ثبت شود.</p>' +
      '<form data-welcome-form novalidate>' + PP.field("name", "نام و نام خانوادگی", '<input class="input" name="name" autocomplete="name" required>') +
      '<button class="btn btn--block" type="submit">ادامه</button><button class="linkbtn" type="button" data-skip-welcome style="justify-self:center">بعداً</button></form></section>';
    focusSoon('input[name="name"]');
  }
  function focusSoon(sel) { setTimeout(function () { var el = $(sel, box); if (el) el.focus(); }, 60); }

  // ------------------------------------------------------------ account shell
  function upcoming(u) {
    var now = PP.tehranNow();
    return store.bookings(u.phone).filter(function (b) {
      return b.status === "booked" && (b.date > now.date || (b.date === now.date && PP.toMin(b.time) >= now.min));
    }).sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  }
  function renderAccount(u) {
    var tab = tabNow();
    var counts = { bookings: upcoming(u).length, orders: store.orders(u.phone).length, favorites: store.favs().length };
    var initial = u.name ? esc(u.name.trim().charAt(0)) : icon("user");
    box.innerHTML = '<h1 class="visually-hidden">حساب کاربری</h1><div class="acct__grid">' +
      '<aside class="acct__side"><div class="me"><span class="me__av" aria-hidden="true">' + initial + '</span><div class="me__t"><b>' + esc(u.name || "کاربر سام") + "</b><span>" + PP.ltr(PP.phoneShow(u.phone)) + "</span></div></div>" +
      '<nav class="menu" aria-label="بخش‌های حساب">' + TABS.map(function (t) {
        var n = counts[t[0]];
        return '<a href="#' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : "") + ">" + icon(t[2]) + t[1] + (n ? "<b>" + n + "</b>" : "") + "</a>";
      }).join("") + '<button class="menu__out" type="button" data-logout>' + icon("logout") + "خروج</button></nav></aside>" +
      '<section class="acct__main" data-panel aria-labelledby="panel-title"></section></div>';
    renderPanel(u, tab);
    var cur = $('.menu [aria-current="page"]', box);
    if (cur && matchMedia("(max-width: 1023.98px)").matches) cur.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
  }
  function renderPanel(u, tab) {
    var el = $("[data-panel]", box);
    if (!el) return;
    el.innerHTML = ({ overview: pOverview, bookings: pBookings, orders: pOrders, favorites: pFavs, skin: pSkin, account: pAccount, addresses: pAddresses })[tab](u);
  }
  function head(title, extra) { return '<div class="panel__h"><h2 id="panel-title" tabindex="-1">' + title + "</h2>" + (extra || "") + "</div>"; }
  function emptyBox(ic, title, text, action) {
    return '<div class="box empty"><svg class="empty__mark" viewBox="0 0 24 24" aria-hidden="true" style="width:48px;height:48px;fill:none;stroke:var(--rose);stroke-width:1.4"><use href="#i-' + ic + '"/></svg><h3>' + title + "</h3><p>" + text + "</p>" + (action || "") + "</div>";
  }

  // ------------------------------------------------------------ panels
  function appt(b, withActs) {
    var f = PP.faDay(b.date), t = TYPES[b.type] || { name: "مشاوره" }, m = MODES[b.mode] || { name: "" };
    var now = PP.tehranNow(), past = b.date < now.date || (b.date === now.date && PP.toMin(b.time) < now.min);
    var tag = b.status === "cancelled" ? '<span class="tag tag--muted">لغوشده</span>' : (past ? '<span class="tag tag--muted">گذشته</span>' : '<span class="tag tag--ok">ثبت‌شده</span>');
    var live = b.status === "booked" && !past;
    return '<article class="appt' + (b.status === "cancelled" ? " is-cancelled" : past ? " is-past" : "") + '">' +
      '<div class="appt__date"><span><b>' + f.d + "</b>" + f.m + "</span></div>" +
      '<p class="appt__t">' + esc(t.name) + " " + tag + "</p>" +
      '<p class="appt__m">' + f.w + "، ساعت " + b.time + " — " + esc(m.name) + ' — کد <bdi class="lat">' + esc(b.code) + "</bdi></p>" +
      (withActs && live ? '<div class="appt__acts"><button class="btn btn--ghost btn--sm" type="button" data-ics="' + b.id + '">' + icon("download") + 'افزودن به تقویم</button><button class="btn btn--danger btn--sm" type="button" data-cancel="' + b.id + '">لغو نوبت</button></div>' : "") +
      "</article>";
  }
  function recs(u) {
    var list;
    if (u.skin || (u.concerns && u.concerns.length)) {
      list = PP.P.filter(function (p) { return p.stock > 0 && p.skin.length; }).map(function (p) {
        var s = (u.skin && p.skin.indexOf(u.skin) > -1 ? 2 : 0) + (u.concerns || []).filter(function (c) { return p.concerns.indexOf(c) > -1; }).length;
        return { p: p, s: s };
      }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s || a.p.rank - b.p.rank; }).slice(0, 4).map(function (x) { return x.p; });
    }
    var personal = list && list.length;
    if (!personal) list = PP.P.filter(function (p) { return p.stock > 0; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 4);
    return '<div class="rec-head"><h3>' + (personal ? "پیشنهاد برای " + (u.skin ? "پوست " + esc(PP.SKIN[u.skin].name) : "دغدغه‌های پوستت") : "پرفروش‌های سام") + "</h3>" +
      '<a class="more" href="' + PP.ROOT + "products/" + (u.skin ? "?skin=" + u.skin : "") + '">بیشتر' + icon("chev-l") + "</a></div>" +
      '<div class="grid grid--fav">' + list.map(function (p) { return PP.card(p); }).join("") + "</div>";
  }
  function pOverview(u) {
    var up = upcoming(u), n = up[0];
    function stat(href, v, label) { return '<a class="stat" href="' + href + '"><b>' + v + "</b><span>" + label + "</span></a>"; }
    var skinTxt = u.skin ? "پوست " + esc(PP.SKIN[u.skin].name) + ((u.concerns || []).length ? "؛ " + u.concerns.map(function (c) { return esc(PP.CONCERN[c].name); }).join("، ") : "") : "";
    return head("سلام" + (u.name ? " " + esc(u.name.trim().split(/\s+/)[0]) : "") + "!") +
      '<div class="stats">' + stat("#bookings", up.length, "نوبت پیش رو") + stat("#orders", store.orders(u.phone).length, "سفارش") + stat("#favorites", store.favs().length, "علاقه‌مندی") + "</div>" +
      (n ? '<div class="box"><h3>نوبت بعدی</h3>' + appt(n, false) + "</div>"
         : '<div class="box"><h3>نوبت مشاوره‌ای نداری</h3><p style="color:var(--ink-2);font-size:14.5px;margin-bottom:14px">یک وقت مشاوره‌ی ' + esc(C.price) + ' بگیر تا کارشناس سام روتین مناسب پوستت را پیشنهاد بدهد.</p><a class="btn btn--sm" href="' + PP.ROOT + 'booking/">' + icon("calendar") + "رزرو وقت مشاوره</a></div>") +
      '<div class="box"><h3>پروفایل پوست</h3>' + (skinTxt ? '<p style="font-size:14.5px">' + skinTxt + '</p><a class="linkbtn" href="#skin">ویرایش</a>'
         : '<p style="color:var(--ink-2);font-size:14.5px;margin-bottom:12px">نوع و دغدغه‌های پوستت را بگو تا محصولات مناسب خودت را ببینی.</p><a class="btn btn--ghost btn--sm" href="#skin">' + icon("face") + "تکمیل پروفایل پوست</a>") + "</div>" +
      recs(u);
  }
  function pBookings(u) {
    var all = store.bookings(u.phone), up = upcoming(u);
    var rest = all.filter(function (b) { return up.indexOf(b) < 0; }).sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
    var h = head("نوبت‌های من", '<a class="btn btn--sm" href="' + PP.ROOT + 'booking/">' + icon("plus") + "نوبت جدید</a>");
    if (!all.length) return h + emptyBox("calendar", "هنوز نوبتی نگرفته‌ای", "مشاوره‌ی پوست، آرایش، مو یا عطر؛ حضوری در فروشگاه یا آنلاین در بله.", '<div class="empty__acts"><a class="btn" href="' + PP.ROOT + 'booking/">رزرو وقت مشاوره</a></div>');
    return h + (up.length ? up.map(function (b) { return appt(b, true); }).join("") : '<p class="note">' + icon("info") + "<span>نوبت پیش رویی نداری.</span></p>") +
      (rest.length ? '<h3 style="font-size:15px;margin:26px 0 12px;color:var(--ink-2)">گذشته و لغوشده</h3>' + rest.map(function (b) { return appt(b, false); }).join("") : "");
  }
  function pOrders(u) {
    var list = store.orders(u.phone).slice().sort(function (a, b) { return b.created - a.created; });
    var h = head("سفارش‌های من");
    if (!list.length) return h + emptyBox("package", "هنوز سفارشی ثبت نکرده‌ای", "محصولات را به سبد اضافه کن و از همان‌جا سفارش بده.", '<div class="empty__acts"><a class="btn" href="' + PP.ROOT + 'products/">مشاهده‌ی محصولات</a></div>');
    return h + list.map(function (o) {
      var d = new Date(o.created), date = PP.faDate(PP.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()));
      var n = o.items.reduce(function (s, i) { return s + i.qty; }, 0);
      return '<article class="order"><div class="order__h"><span>سفارش <b dir="ltr">' + esc(o.code) + "</b></span><span>" + date + ' <span class="tag">در انتظار تأیید</span></span></div>' +
        '<div class="order__thumbs">' + o.items.slice(0, 5).map(function (i) { var p = PP.byId[i.id]; return p ? '<img src="' + PP.img(p) + '" alt="' + esc(PP.plain(p.name)) + '">' : ""; }).join("") + "</div>" +
        '<div class="order__f"><span>' + n + " کالا — " + ((PP.D.site.ship.filter(function (s) { return s.id === o.ship; })[0] || { name: o.ship === "post" ? "ارسال پستی" : "تحویل در فروشگاه" }).name) + "</span><b>" + PP.fmt(o.total) + " تومان</b></div></article>";
    }).join("");
  }
  function pFavs() {
    var favs = store.favs(), h = head("علاقه‌مندی‌ها");
    if (!favs.length) return h + emptyBox("heart", "هنوز چیزی را نپسندیده‌ای", "روی قلب کارت هر محصول بزن تا اینجا بماند.", '<div class="empty__acts"><a class="btn" href="' + PP.ROOT + 'products/">مشاهده‌ی محصولات</a></div>');
    return h + '<div class="grid grid--fav">' + favs.map(function (p) { return PP.card(p); }).join("") + "</div>";
  }
  function pSkin(u) {
    var skins = PP.D.skin.concat([{ id: "", name: "نمی‌دانم" }]);
    return head("پروفایل پوست") + '<p class="panel__sub">نوع و دغدغه‌های پوستت را انتخاب کن تا در پیشخوان، محصولات مناسب خودت را ببینی.</p>' +
      '<form data-skin-form novalidate>' +
        '<fieldset><legend class="lbl" style="margin-bottom:10px">نوع پوست</legend><div class="skin-opts">' + skins.map(function (s) {
          return '<label class="opt"><input type="radio" name="skin" value="' + s.id + '"' + ((u.skin || "") === s.id ? " checked" : "") + '><span class="opt__card"><span class="opt__t">' + esc(s.name) + "</span></span></label>";
        }).join("") + "</div></fieldset>" +
        '<fieldset style="margin-top:24px"><legend class="lbl" style="margin-bottom:10px">دغدغه‌های پوستت <span style="font-weight:400;color:var(--mist)">(چند مورد)</span></legend><div class="chips">' + PP.D.concerns.map(function (c) {
          return '<button class="chip" type="button" data-concern="' + c.id + '" aria-pressed="' + ((u.concerns || []).indexOf(c.id) > -1) + '">' + esc(c.name) + "</button>";
        }).join("") + "</div></fieldset>" +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:26px"><button class="btn" type="submit">ذخیره</button><a class="btn btn--ghost" href="' + PP.ROOT + 'booking/?type=skin">نوع پوستت را نمی‌دانی؟ مشاوره بگیر</a></div>' +
      "</form>";
  }
  function pAccount(u) {
    var b = u.birth || {}, jy = PP.g2j(new Date().getFullYear(), 1, 1)[0];
    function sel(name, label, opts, v) {
      return '<label class="select"><span class="visually-hidden">' + label + '</span><select name="' + name + '" aria-label="' + label + '"><option value="">' + label + "</option>" +
        opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v || "") ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" + icon("chev-d") + "</label>";
    }
    var days = [], months = [], years = [];
    for (var d = 1; d <= 31; d++) days.push([d, d]);
    PP.MONTHS.forEach(function (m, i) { months.push([i + 1, m]); });
    for (var y = jy - 12; y >= jy - 80; y--) years.push([y, y]);
    return head("اطلاعات حساب") +
      '<form class="form" data-account-form novalidate>' +
        PP.field("name", "نام و نام خانوادگی", '<input class="input" name="name" autocomplete="name" value="' + esc(u.name) + '" required>') +
        PP.field("phone", "شماره‌ی موبایل", '<input class="input input--ltr" name="phone" dir="ltr" value="' + esc(PP.phoneShow(u.phone)) + '" readonly>', "برای تغییر شماره، از حساب خارج شو و با شماره‌ی جدید وارد شو.") +
        PP.field("email", "ایمیل (اختیاری)", '<input class="input input--ltr" name="email" type="email" dir="ltr" autocomplete="email" value="' + esc(u.email) + '">') +
        '<div class="field" data-field="birth"><span class="lbl">تاریخ تولد (اختیاری)</span><div class="date3">' + sel("bd", "روز", days, b.d) + sel("bm", "ماه", months, b.m) + sel("by", "سال", years, b.y) + '</div><p class="err" id="err-birth" hidden></p></div>' +
        '<div><button class="btn" type="submit">ذخیره‌ی تغییرات</button></div>' +
      "</form>";
  }
  function addrForm(a) {
    a = a || {};
    return '<form class="box form" data-addr-form novalidate style="max-width:none;margin-bottom:14px">' +
      "<h3>" + (a.id ? "ویرایش آدرس" : "آدرس جدید") + "</h3>" +
      '<div class="form-grid form-grid--2">' +
        PP.field("title", "عنوان", '<input class="input" name="title" placeholder="مثلاً خانه یا محل کار" value="' + esc(a.title) + '">') +
        PP.field("city", "شهر", '<input class="input" name="city" autocomplete="address-level2" value="' + esc(a.city) + '" required>') +
      "</div>" +
      PP.field("line", "آدرس کامل", '<textarea class="textarea" name="line" rows="2" autocomplete="street-address" required>' + esc(a.line) + "</textarea>") +
      '<div class="form-grid form-grid--2">' +
        PP.field("postal", "کد پستی (اختیاری)", '<input class="input input--ltr" name="postal" inputmode="numeric" dir="ltr" maxlength="12" value="' + esc(a.postal) + '">') +
        PP.field("receiver", "نام گیرنده", '<input class="input" name="receiver" value="' + esc(a.receiver) + '">') +
      "</div>" +
      '<div style="display:flex;gap:10px"><button class="btn" type="submit">ذخیره‌ی آدرس</button><button class="btn btn--ghost" type="button" data-addr-cancel>انصراف</button></div>' +
      "</form>";
  }
  function pAddresses(u) {
    var list = u.addresses || [];
    var editing = addrEdit === "new" ? {} : list.filter(function (a) { return a.id === addrEdit; })[0];
    var h = head("آدرس‌ها", addrEdit ? "" : '<button class="btn btn--sm" type="button" data-addr-new>' + icon("plus") + "آدرس جدید</button>");
    if (editing) h += addrForm(editing);
    if (!list.length && !editing) return h + emptyBox("pin", "هنوز آدرسی ذخیره نکرده‌ای", "آدرس را یک بار ذخیره کن تا هنگام سفارش خودکار پر شود.", '<div class="empty__acts"><button class="btn" type="button" data-addr-new>افزودن آدرس</button></div>');
    return h + list.map(function (a) {
      return '<article class="addr"><b>' + esc(a.title || "آدرس") + "</b>" +
        '<div class="addr__acts"><button class="iconbtn" type="button" data-addr-edit="' + a.id + '" aria-label="ویرایش ' + esc(a.title || "آدرس") + '">' + icon("edit") + '</button><button class="iconbtn" type="button" data-addr-del="' + a.id + '" aria-label="حذف ' + esc(a.title || "آدرس") + '">' + icon("trash") + "</button></div>" +
        "<p>" + esc(a.city) + "، " + esc(a.line) + (a.postal ? " — کد پستی " + PP.ltr(a.postal) : "") + (a.receiver ? " — گیرنده: " + esc(a.receiver) : "") + "</p></article>";
    }).join("");
  }

  // ------------------------------------------------------------ dialogs
  function confirmDialog(title, text, okLabel, onOk) {
    var picker = $("#picker"), body = $("[data-picker-body]", picker);
    body.onchange = null;
    body.innerHTML = '<header class="sheet__head"><h2 id="picker-title">' + title + '</h2><button class="iconbtn" type="button" data-close aria-label="بستن">' + icon("x") + "</button></header>" +
      '<p style="color:var(--ink-2)">' + text + "</p>" +
      '<div style="display:flex;gap:10px;margin-top:22px"><button class="btn btn--ghost btn--grow" type="button" data-close data-keep>انصراف</button><button class="btn btn--grow" type="button" data-ok style="background:var(--err);border-color:var(--err)">' + okLabel + "</button></div>";
    $("[data-ok]", body).onclick = function () { PP.Layers.close(picker).then(onOk); };
    PP.Layers.open(picker, "[data-keep]");
  }

  // ------------------------------------------------------------ events (delegated, bound once)
  box.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, u = store.user();
    if (f.matches("[data-phone-form]")) {
      var ph = f.elements.phone;
      if (!PP.validateField(ph)) { ph.focus(); return; }
      auth.phone = PP.phoneNorm(ph.value);
      auth.stage = "code";
      newCode();
      renderAuth();
    } else if (f.matches("[data-code-form]")) {
      verify(f);
    } else if (f.matches("[data-welcome-form]")) {
      var n = f.elements.name;
      if (!PP.validateField(n)) { n.focus(); return; }
      store.updateUser({ name: n.value.trim() });
      auth.stage = "done";
      render();
      PP.toast("خوش آمدی، " + esc(n.value.trim().split(/\s+/)[0]) + "!");
    } else if (f.matches("[data-skin-form]") && u) {
      var s = f.querySelector('input[name="skin"]:checked');
      var concerns = $$('[data-concern][aria-pressed="true"]', f).map(function (b) { return b.dataset.concern; });
      store.updateUser({ skin: s ? s.value : "", concerns: concerns });
      PP.toast("پروفایل پوست ذخیره شد", { action: { label: "دیدن پیشنهادها", href: "#overview" } });
    } else if (f.matches("[data-account-form]") && u) {
      var ok = PP.validateField(f.elements.name);
      var em = f.elements.email.value.trim();
      ok = PP.setErr(f.elements.email, em && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) ? "ایمیل درست نیست؛ مثلاً name@example.com" : "") && ok;
      var bd = +f.elements.bd.value, bm = +f.elements.bm.value, by = +f.elements.by.value, errB = $("#err-birth", f), birth = null;
      if (bd || bm || by) {
        if (!(bd && bm && by)) { errB.textContent = "روز، ماه و سال را کامل انتخاب کن."; errB.hidden = false; ok = false; }
        else if (bd > PP.jLen(by, bm)) { errB.textContent = PP.MONTHS[bm - 1] + " سال " + by + " فقط " + PP.jLen(by, bm) + " روز دارد."; errB.hidden = false; ok = false; }
        else { errB.hidden = true; birth = { d: bd, m: bm, y: by }; }
      } else errB.hidden = true;
      if (!ok) { var bad = f.querySelector('[aria-invalid="true"]') || f.elements.bd; bad.focus(); return; }
      store.updateUser({ name: f.elements.name.value.trim(), email: em, birth: birth });
      PP.toast("تغییرات ذخیره شد");
    } else if (f.matches("[data-addr-form]") && u) {
      var need = [f.elements.city, f.elements.line], bad2 = null;
      need.forEach(function (el) { if (!PP.setErr(el, el.value.trim().length < (el.name === "line" ? 10 : 2) ? (el.name === "line" ? "آدرس را کامل‌تر بنویس." : "شهر را بنویس.") : "") && !bad2) bad2 = el; });
      var pc = PP.toLatin(f.elements.postal.value).replace(/[^0-9]/g, "");
      if (pc && pc.length !== 10) { PP.setErr(f.elements.postal, "کد پستی ۱۰ رقم است."); bad2 = bad2 || f.elements.postal; } else PP.setErr(f.elements.postal, "");
      if (bad2) { bad2.focus(); return; }
      var rec = { id: addrEdit && addrEdit !== "new" ? addrEdit : "a" + Date.now(), title: f.elements.title.value.trim(), city: f.elements.city.value.trim(), line: f.elements.line.value.trim(), postal: pc, receiver: f.elements.receiver.value.trim() };
      var list = (u.addresses || []).filter(function (a) { return a.id !== rec.id; });
      if (addrEdit === "new") list.unshift(rec); else list.splice(Math.max(0, (u.addresses || []).findIndex(function (a) { return a.id === rec.id; })), 0, rec);
      addrEdit = null;
      store.updateUser({ addresses: list });
      PP.toast("آدرس ذخیره شد");
    }
  });
  function verify(f) {
    var inp = f.elements.code, v = PP.toLatin(inp.value).replace(/[^0-9]/g, "");
    if (v.length !== 5) { PP.setErr(inp, "کد ۵ رقمی را کامل وارد کن."); inp.focus(); return; }
    if (Date.now() > auth.until) { PP.setErr(inp, "این کد منقضی شده؛ کد تازه بگیر."); return; }
    if (v !== auth.code) { PP.setErr(inp, "کد درست نیست؛ دوباره بررسی کن."); inp.select(); return; }
    stopTimer();
    var u = store.login(auth.phone), fresh = !u.name;
    if (fresh) {
      // a guest who already booked or ordered with this number has told us their name
      var known = store.orders(u.phone).concat(store.bookings(u.phone))
        .sort(function (x, y) { return y.created - x.created; })
        .map(function (x) { return x.name; }).filter(Boolean)[0];
      if (known) { store.updateUser({ name: known }); u = store.user(); }
    }
    auth.stage = u.name ? "done" : "welcome";
    render();
    if (u.name) PP.toast((fresh ? "خوش آمدی، " : "خوش برگشتی، ") + esc(u.name.trim().split(/\s+/)[0]) + "!");
  }
  box.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "otp") {
      t.value = PP.toLatin(t.value).replace(/[^0-9]/g, "").slice(0, 5);
      if (t.getAttribute("aria-invalid") === "true") PP.setErr(t, "");
      if (t.value.length === 5) verify(t.form);
    } else if (t.getAttribute("aria-invalid") === "true" && t.name) {
      if (t.name === "email") PP.setErr(t, ""); else PP.validateField(t);
    }
  });
  box.addEventListener("click", function (e) {
    var b;
    if (e.target.closest("[data-edit-phone]")) { auth.stage = "phone"; renderAuth(); focusSoon('input[name="phone"]'); return; }
    if (e.target.closest("[data-resend]")) { newCode(); renderAuth(); PP.toast(PP.DEMO ? "کد تازه ساخته شد" : "کد دوباره پیامک شد"); return; }
    if (e.target.closest("[data-skip-welcome]")) { auth.stage = "done"; render(); return; }
    if ((b = e.target.closest("[data-concern]"))) { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); return; }
    if ((b = e.target.closest("[data-ics]"))) { PP.downloadICS(store.allBookings().filter(function (x) { return x.id === b.dataset.ics; })[0]); return; }
    if ((b = e.target.closest("[data-cancel]"))) {
      var id = b.dataset.cancel, bk = store.allBookings().filter(function (x) { return x.id === id; })[0];
      if (!bk) return;
      confirmDialog("لغو نوبت؟", "نوبت " + esc((TYPES[bk.type] || {}).name || "") + "، " + esc(PP.faDate(bk.date, true)) + " ساعت " + bk.time + " لغو می‌شود و وقتش برای دیگران آزاد می‌شود.", "بله، لغو شود", function () {
        store.cancelBooking(id);
        PP.toast("نوبت لغو شد");
      });
      return;
    }
    if (e.target.closest("[data-logout]")) {
      confirmDialog("خروج از حساب؟", "سبد خرید و علاقه‌مندی‌هایت در همین مرورگر می‌ماند.", "خروج", function () {
        store.logout();
        auth = { stage: "phone", phone: "", code: "", until: 0, timer: null };
        render();
        PP.toast("از حساب خارج شدی");
      });
      return;
    }
    if (e.target.closest("[data-addr-new]")) { addrEdit = "new"; rerender(); focusSoon('[data-addr-form] input[name="title"]'); return; }
    if ((b = e.target.closest("[data-addr-edit]"))) { addrEdit = b.dataset.addrEdit; rerender(); focusSoon('[data-addr-form] input[name="title"]'); return; }
    if (e.target.closest("[data-addr-cancel]")) { addrEdit = null; rerender(); return; }
    if ((b = e.target.closest("[data-addr-del]"))) {
      var aid = b.dataset.addrDel;
      confirmDialog("حذف آدرس؟", "این آدرس از حسابت حذف می‌شود.", "حذف", function () {
        var u = store.user();
        store.updateUser({ addresses: (u.addresses || []).filter(function (a) { return a.id !== aid; }) });
        PP.toast("آدرس حذف شد");
      });
    }
  });
  function rerender() { var u = store.user(); if (u) renderPanel(u, tabNow()); }

  // ------------------------------------------------------------ routing
  function render() {
    var u = store.user();
    if (!u) { if (auth.stage !== "code") auth.stage = "phone"; renderAuth(); return; }
    if (auth.stage === "welcome") { renderWelcome(); return; }
    renderAccount(u);
  }
  window.addEventListener("hashchange", function () {
    var u = store.user();
    if (!u || auth.stage === "welcome") return;
    addrEdit = null;
    renderAccount(u);
    var h = $("#panel-title", box);
    if (h) h.focus({ preventScroll: true });
    var grid = $(".acct__grid", box);
    if (grid && grid.getBoundingClientRect().top < 0) window.scrollTo({ top: grid.getBoundingClientRect().top + scrollY - 90, behavior: "auto" });
  });
  // another tab signs in or out, a favourite is removed, a booking is cancelled…
  document.addEventListener("store", function () {
    var u = store.user();
    if (!u) { if (auth.stage === "done" || auth.stage === "welcome") { auth.stage = "phone"; render(); } return; }
    if (auth.stage === "phone" || auth.stage === "code") return;
    var active = document.activeElement;
    if (active && box.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;   // never yank a form mid-edit
    renderAccount(u);
  });

  if (store.user()) auth.stage = "done";
  render();
})();
