/* Products — categories, faceted filters, sort, search, paging.
   The URL is the state: every filter is written back with replaceState (after
   any open sheet has released its history entry), so a filtered view can be
   shared and survives a reload. Changing category is a real navigation. */
(function () {
  "use strict";
  var PP = window.PP, $ = PP.$, $$ = PP.$$, esc = PP.esc, fmt = PP.fmt;
  var form = $("[data-filter-form]"), grid = $("[data-grid]"), moreEl = $("[data-more]");
  if (!form || !grid) return;
  var filtersEl = $("#filters"), countEl = $("[data-shop-count]"), titleEl = $("[data-shop-title]"),
      activeEl = $("[data-active-chips]"), sortEl = $("[data-sort]"), qEl = $("[data-shop-q]"),
      fcount = $("[data-filter-count]"), showBtn = $("[data-show-results]"), toolbar = $(".toolbar");
  var PAGE = 12, STEP = 10000;
  var SORTS = {
    rank: function (a, b) { return (b.stock > 0) - (a.stock > 0) || a.rank - b.rank; },
    new: function (a, b) { return (b.stock > 0) - (a.stock > 0) || (b.new - a.new) || a.rank - b.rank; },
    cheap: function (a, b) { return (b.stock > 0) - (a.stock > 0) || a.price - b.price; },
    dear: function (a, b) { return (b.stock > 0) - (a.stock > 0) || b.price - a.price; },
    off: function (a, b) { return (b.stock > 0) - (a.stock > 0) || b.off - a.off || a.rank - b.rank; }
  };

  function list(v) { return v ? String(v).split(",").filter(Boolean) : []; }
  function num(v) { var n = parseInt(PP.toLatin(v), 10); return isFinite(n) ? n : null; }
  function readURL() {
    var u = new URLSearchParams(location.search), cat = u.get("cat") || "";
    if (!PP.CAT[cat]) cat = "";
    var s = {
      cat: cat,
      sub: list(u.get("sub")).filter(function (x) { return PP.SUB[x]; }),
      brand: list(u.get("brand")).filter(function (x) { return PP.BRAND[x]; }),
      skin: list(u.get("skin")).filter(function (x) { return PP.SKIN[x]; }),
      min: num(u.get("min")), max: num(u.get("max")),
      stock: u.get("stock") === "1", sale: u.get("sale") === "1",
      sort: SORTS[u.get("sort")] ? u.get("sort") : "rank",
      q: (u.get("q") || "").slice(0, 80)
    };
    if (!s.cat && s.sub.length) s.cat = PP.SUB[s.sub[0]].cat;
    s.sub = s.sub.filter(function (x) { return PP.SUB[x].cat === s.cat; });
    return s;
  }
  var st = readURL();
  var pool = PP.P.filter(function (p) { return !st.cat || p.cat === st.cat; });
  var LO = Math.floor(Math.min.apply(null, pool.map(function (p) { return p.price; })) / STEP) * STEP;
  var HI = Math.ceil(Math.max.apply(null, pool.map(function (p) { return p.price; })) / STEP) * STEP;
  function clampPrice() {
    if (st.min != null) st.min = Math.max(LO, Math.min(st.min, HI));
    if (st.max != null) st.max = Math.max(LO, Math.min(st.max, HI));
    if (st.min != null && st.max != null && st.min > st.max) { var t = st.min; st.min = st.max; st.max = t; }
    if (st.min === LO) st.min = null;
    if (st.max === HI) st.max = null;
  }
  clampPrice();
  var shown = PAGE, results = [];

  function writeURL() {
    PP.Layers.whenClear(function () {
      var u = new URLSearchParams();
      if (st.cat) u.set("cat", st.cat);
      if (st.sub.length) u.set("sub", st.sub.join(","));
      if (st.brand.length) u.set("brand", st.brand.join(","));
      if (st.skin.length) u.set("skin", st.skin.join(","));
      if (st.min != null) u.set("min", st.min);
      if (st.max != null) u.set("max", st.max);
      if (st.stock) u.set("stock", "1");
      if (st.sale) u.set("sale", "1");
      if (st.sort !== "rank") u.set("sort", st.sort);
      if (st.q) u.set("q", st.q);
      var qs = u.toString().replace(/%2C/g, ",");
      try { history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "")); } catch (e) { /* file:// */ }
    });
  }

  function match(p, skip) {
    if (st.cat && p.cat !== st.cat) return false;
    if (skip !== "sub" && st.sub.length && st.sub.indexOf(p.sub) < 0) return false;
    if (skip !== "brand" && st.brand.length && st.brand.indexOf(p.brand) < 0) return false;
    if (skip !== "skin" && st.skin.length && !st.skin.some(function (s) { return p.skin.indexOf(s) > -1; })) return false;
    if (skip !== "price" && st.min != null && p.price < st.min) return false;
    if (skip !== "price" && st.max != null && p.price > st.max) return false;
    if (skip !== "stock" && st.stock && p.stock < 1) return false;
    if (skip !== "sale" && st.sale && !p.off) return false;
    if (st.q && !PP.matchQ(p, st.q)) return false;
    return true;
  }

  // ------------------------------------------------------------ form
  function group(key, title, body, open) {
    return '<details class="fgroup" data-group="' + key + '"' + (open ? " open" : "") + "><summary><span>" + title + '<em data-group-n="' + key + '"></em></span>' + PP.icon("chev-d") + "</summary>" +
      '<div class="fgroup__body">' + body + "</div></details>";
  }
  function row(name, value, label, lat) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="' + value + '"><span class="check__box" aria-hidden="true"></span>' +
      '<span class="check__t' + (lat ? " lat" : "") + '"' + (lat ? ' dir="ltr" lang="en"' : "") + ">" + label + '</span><span class="check__n" data-n="' + name + ":" + value + '"></span></label>';
  }
  function renderForm() {
    var h = "";
    if (st.cat) {
      h += group("sub", "نوع محصول", PP.CAT[st.cat].subs.map(function (s) { return row("sub", s.id, esc(s.name)); }).join(""), true);
    }
    var brands = PP.D.brands.filter(function (b) { return pool.some(function (p) { return p.brand === b.id; }); })
      .sort(function (a, b) { return a.en.localeCompare(b.en); });
    h += group("brand", "برند",
      (brands.length > 8 ? '<input class="input fgroup__search" type="search" placeholder="جستجوی برند" aria-label="جستجوی برند" data-brand-q>' : "") +
      '<div class="fgroup__list fgroup__list--lat">' + brands.map(function (b) { return row("brand", b.id, esc(b.en), true); }).join("") + "</div>", true);
    if (pool.some(function (p) { return p.skin.length; })) {
      h += group("skin", "نوع پوست", '<div class="chips">' + PP.D.skin.map(function (s) {
        return '<button class="chip" type="button" data-skin="' + s.id + '" aria-pressed="false">' + esc(s.name) + "</button>";
      }).join("") + "</div>", true);
    }
    h += group("price", "محدوده‌ی قیمت",
      '<div class="range" data-range><div class="range__track"></div><div class="range__fill" data-fill></div>' +
      '<input type="range" data-lo min="' + LO + '" max="' + HI + '" step="' + STEP + '" value="' + LO + '" aria-label="حداقل قیمت">' +
      '<input type="range" data-hi min="' + LO + '" max="' + HI + '" step="' + STEP + '" value="' + HI + '" aria-label="حداکثر قیمت"></div>' +
      '<div class="range__vals"><span>از <b data-lo-v></b> تومان</span><span>تا <b data-hi-v></b> تومان</span></div>', true);
    h += group("status", "وضعیت",
      '<label class="switch"><span>فقط کالاهای موجود</span><input type="checkbox" role="switch" name="stock"><span class="switch__track" aria-hidden="true"></span></label>' +
      '<label class="switch"><span>فقط تخفیف‌دارها</span><input type="checkbox" role="switch" name="sale"><span class="switch__track" aria-hidden="true"></span></label>', true);
    form.innerHTML = h;
  }
  function syncForm() {
    $$('input[name="sub"]', form).forEach(function (i) { i.checked = st.sub.indexOf(i.value) > -1; });
    $$('input[name="brand"]', form).forEach(function (i) { i.checked = st.brand.indexOf(i.value) > -1; });
    $$("[data-skin]", form).forEach(function (b) { b.setAttribute("aria-pressed", st.skin.indexOf(b.dataset.skin) > -1 ? "true" : "false"); });
    var s = $('input[name="stock"]', form), o = $('input[name="sale"]', form);
    if (s) s.checked = st.stock;
    if (o) o.checked = st.sale;
    var lo = $("[data-lo]", form), hi = $("[data-hi]", form);
    if (lo) { lo.value = st.min != null ? st.min : LO; hi.value = st.max != null ? st.max : HI; paintRange(); }
    if (qEl) qEl.value = st.q;
    if (sortEl) sortEl.value = st.sort;
  }
  function paintRange() {
    var lo = $("[data-lo]", form), hi = $("[data-hi]", form), fill = $("[data-fill]", form);
    if (!lo) return;
    var a = +lo.value, b = +hi.value, span = HI - LO || 1;
    fill.style.right = ((a - LO) / span * 100) + "%";
    fill.style.left = ((HI - b) / span * 100) + "%";
    $("[data-lo-v]", form).textContent = fmt(a);
    $("[data-hi-v]", form).textContent = fmt(b);
    lo.style.zIndex = a > LO + span / 2 ? 3 : 1;
    hi.style.zIndex = 2;
  }
  function updateFacets() {
    $$("[data-n]", form).forEach(function (el) {
      var k = el.dataset.n.split(":"), field = k[0], val = k[1];
      var n = PP.P.filter(function (p) { return match(p, field) && p[field] === val; }).length;
      el.textContent = n;
      var input = el.parentNode.querySelector("input");
      input.disabled = !n && !input.checked;
    });
    $$("[data-skin]", form).forEach(function (b) {
      var n = PP.P.filter(function (p) { return match(p, "skin") && p.skin.indexOf(b.dataset.skin) > -1; }).length;
      b.disabled = !n && b.getAttribute("aria-pressed") !== "true";
    });
    var sel = { sub: st.sub.length, brand: st.brand.length, skin: st.skin.length, price: (st.min != null || st.max != null) ? 1 : 0, status: (st.stock ? 1 : 0) + (st.sale ? 1 : 0) };
    $$("[data-group-n]", form).forEach(function (em) { var n = sel[em.dataset.groupN]; em.textContent = n ? n + " مورد" : ""; });
  }

  // ------------------------------------------------------------ results
  function renderGrid(append) {
    if (!results.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg class="empty__mark" viewBox="0 0 24 24" aria-hidden="true" style="width:52px;height:52px;fill:none;stroke:var(--rose);stroke-width:1.4"><use href="#i-search"/></svg>' +
        "<h2>" + (st.q ? "برای «" + esc(st.q) + "» محصولی پیدا نشد" : "محصولی با این فیلترها نیست") + "</h2>" +
        "<p>چند فیلتر را بردار یا در همه‌ی دسته‌ها بگرد.</p>" +
        '<div class="empty__acts"><button class="btn" type="button" data-clear-all>حذف همه‌ی فیلترها</button>' +
        (st.cat ? '<a class="btn btn--ghost" href="' + PP.ROOT + 'products/">همه‌ی محصولات</a>' : "") + "</div></div>";
      moreEl.innerHTML = "";
      return;
    }
    var from = append ? grid.children.length : 0;
    var html = results.slice(from, shown).map(function (p) { return PP.card(p, { lazy: true }); }).join("");
    if (append) grid.insertAdjacentHTML("beforeend", html); else grid.innerHTML = html;
    var left = results.length - Math.min(shown, results.length);
    moreEl.innerHTML = left > 0 ? '<button class="btn btn--ghost" type="button" data-more-btn>نمایش ' + Math.min(PAGE, left) + " محصول دیگر" +
      '<span style="color:var(--mist);font-weight:400">(از ' + left + ")</span></button>" : "";
  }
  function chip(label, key, val) {
    return '<button class="achip" type="button" data-rm="' + key + '"' + (val != null ? ' data-v="' + esc(val) + '"' : "") + ' aria-label="حذف فیلتر ' + esc(label.replace(/<[^>]+>/g, "")) + '">' + label + PP.icon("x") + "</button>";
  }
  function renderActive() {
    var c = [];
    if (st.q) c.push(chip("«" + esc(st.q) + "»", "q"));
    st.sub.forEach(function (s) { c.push(chip(esc(PP.SUB[s].name), "sub", s)); });
    st.brand.forEach(function (b) { c.push(chip('<span class="lat" dir="ltr">' + esc(PP.BRAND[b].en) + "</span>", "brand", b)); });
    st.skin.forEach(function (s) { c.push(chip("پوست " + esc(PP.SKIN[s].name), "skin", s)); });
    if (st.min != null || st.max != null) c.push(chip((st.min != null ? "از " + fmt(st.min) : "") + (st.min != null && st.max != null ? " " : "") + (st.max != null ? "تا " + fmt(st.max) : "") + " تومان", "price"));
    if (st.stock) c.push(chip("فقط موجود", "stock"));
    if (st.sale) c.push(chip("فقط تخفیف‌دار", "sale"));
    if (c.length > 1) c.push('<button class="linkbtn" type="button" data-clear-all style="padding:0 8px">حذف همه</button>');
    activeEl.innerHTML = c.join("");
    var n = st.sub.length + st.brand.length + st.skin.length + ((st.min != null || st.max != null) ? 1 : 0) + (st.stock ? 1 : 0) + (st.sale ? 1 : 0);
    if (fcount) { fcount.hidden = !n; fcount.textContent = n; }
  }
  function renderHead() {
    var cat = st.cat ? PP.CAT[st.cat] : null;
    var title = cat ? cat.name : (st.q ? "نتایج جستجو" : "همه‌ی محصولات");
    titleEl.textContent = title;
    countEl.textContent = results.length ? results.length + " محصول" : "";
    document.title = (st.q ? "«" + st.q + "» — " : "") + title + " | " + PP.D.site.name;
    var crumb = $("[data-crumb-cat]");
    if (crumb) { crumb.hidden = !cat; if (cat) crumb.textContent = cat.name; }
    $$("[data-cat-chip]").forEach(function (a) {
      if (a.dataset.catChip === st.cat) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
    if (showBtn) showBtn.textContent = results.length ? "نمایش " + results.length + " محصول" : "محصولی پیدا نشد";
  }
  function apply(keepPage) {
    if (!keepPage) shown = PAGE;
    results = PP.P.filter(function (p) { return match(p); }).sort(SORTS[st.sort]);
    renderGrid(false);
    updateFacets();
    renderActive();
    renderHead();
    writeURL();
    stuck();
  }

  // ------------------------------------------------------------ events
  form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "sub" || t.name === "brand") {
      var arr = st[t.name], i = arr.indexOf(t.value);
      if (t.checked && i < 0) arr.push(t.value);
      if (!t.checked && i > -1) arr.splice(i, 1);
      apply();
    } else if (t.name === "stock" || t.name === "sale") {
      st[t.name] = t.checked;
      apply();
    } else if (t.matches("[data-lo], [data-hi]")) {
      readRange();
      apply();
    }
  });
  var liveRange = PP.debounce(function () { readRange(); apply(); }, 180);
  form.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-lo], [data-hi]")) {
      var lo = $("[data-lo]", form), hi = $("[data-hi]", form);
      if (+lo.value > +hi.value - STEP) { if (t === lo) lo.value = +hi.value - STEP; else hi.value = +lo.value + STEP; }
      paintRange();
      liveRange();
    } else if (t.matches("[data-brand-q]")) {
      var q = PP.norm(t.value);
      $$('input[name="brand"]', form).forEach(function (i) {
        var b = PP.BRAND[i.value];
        i.closest(".check").hidden = !!q && PP.norm(b.en + " " + b.fa).indexOf(q) < 0;
      });
    }
  });
  function readRange() {
    var lo = +$("[data-lo]", form).value, hi = +$("[data-hi]", form).value;
    st.min = lo > LO ? lo : null;
    st.max = hi < HI ? hi : null;
  }
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-skin]");
    if (!b) return;
    var i = st.skin.indexOf(b.dataset.skin);
    if (i > -1) st.skin.splice(i, 1); else st.skin.push(b.dataset.skin);
    b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
    apply();
  });
  function clearAll() {
    st.sub = []; st.brand = []; st.skin = []; st.min = null; st.max = null; st.stock = false; st.sale = false; st.q = "";
    syncForm();
    apply();
  }
  document.addEventListener("click", function (e) {
    var b;
    if (e.target.closest("[data-clear-all]")) { clearAll(); return; }
    if ((b = e.target.closest("[data-rm]"))) {
      var k = b.dataset.rm, v = b.dataset.v;
      if (k === "q") st.q = "";
      else if (k === "price") { st.min = null; st.max = null; }
      else if (k === "stock" || k === "sale") st[k] = false;
      else st[k] = st[k].filter(function (x) { return x !== v; });
      syncForm();
      apply();
      return;
    }
    if (e.target.closest("[data-more-btn]")) {
      shown += PAGE;
      renderGrid(true);
      var first = grid.children[shown - PAGE];
      if (first) { var a = first.querySelector(".card__body"); if (a) a.focus({ preventScroll: true }); }
      return;
    }
    if (e.target.closest("[data-open-filters]")) { PP.Layers.open(filtersEl); }
  });
  if (sortEl) sortEl.addEventListener("change", function () { st.sort = sortEl.value; apply(); });
  if (qEl) qEl.addEventListener("input", PP.debounce(function () { st.q = qEl.value.trim().slice(0, 80); apply(); }, 220));
  if (filtersEl) filtersEl.addEventListener("layer:close", function () {
    PP.Layers.whenClear(function () {
      var top = grid.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) window.scrollTo({ top: Math.max(0, grid.getBoundingClientRect().top + scrollY - 150), behavior: "auto" });
    });
  });
  // a sheet left open while the window grows into the desktop layout
  var mq = matchMedia("(min-width: 1024px)");
  function onMQ() { if (mq.matches && PP.Layers.isOpen(filtersEl)) PP.Layers.close(filtersEl); }
  if (mq.addEventListener) mq.addEventListener("change", onMQ); else mq.addListener(onMQ);

  function stuck() {
    if (!toolbar) return;
    var head = parseFloat(getComputedStyle(toolbar).top) || 0;
    toolbar.classList.toggle("is-stuck", toolbar.getBoundingClientRect().top <= head + 1 && scrollY > 40);
  }
  window.addEventListener("scroll", stuck, { passive: true });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { st = readURL(); clampPrice(); syncForm(); apply(); } });

  renderForm();
  syncForm();
  apply();
  var cur = $('[data-cat-chip][aria-current="true"]');
  if (cur && st.cat) cur.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
})();
