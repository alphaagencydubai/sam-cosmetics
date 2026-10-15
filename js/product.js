/* Product page — shade, quantity, add to cart, the phone buy bar, related rail.
   The page itself is static HTML from build.py. */
(function () {
  "use strict";
  var PP = window.PP, $ = PP.$, $$ = PP.$$;
  var root = $("[data-product]");
  if (!root) return;
  var p = PP.byId[root.dataset.product];
  if (!p) return;

  var qty = 1, max = Math.max(1, Math.min(p.stock, 10));
  var out = $("[data-qty-val]"), dec = $("[data-qty-dec]"), inc = $("[data-qty-inc]");
  function paintQty() {
    if (!out) return;
    out.textContent = qty;
    dec.disabled = qty <= 1;
    inc.disabled = qty >= max;
  }
  if (dec) dec.addEventListener("click", function () { qty = Math.max(1, qty - 1); paintQty(); });
  if (inc) inc.addEventListener("click", function () { qty = Math.min(max, qty + 1); paintQty(); });
  paintQty();

  var shadeName = $("[data-shade-name]");
  var hero = $(".pp__well img", root);
  root.addEventListener("change", function (e) {
    if (e.target.name !== "shade") return;
    if (shadeName) shadeName.textContent = e.target.value;
    if (hero && p.shadeArt) hero.src = PP.img(p, e.target.value);
  });
  function shade() { var r = $('input[name="shade"]:checked', root); return r ? r.value : ""; }

  $$("[data-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      PP.addToCart(p.id, shade(), qty);
      qty = 1;
      paintQty();
    });
  });

  // buy bar: appears on phones once the real buy row has scrolled away
  var bar = $("[data-buybar]"), buy = $("[data-buy]");
  if (bar && buy && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      var show = !e.isIntersecting && e.boundingClientRect.top < 0;
      bar.classList.toggle("is-shown", show);
      bar.setAttribute("aria-hidden", show ? "false" : "true");
      $$("a, button", bar).forEach(function (el) { el.tabIndex = show ? 0 : -1; });
      document.body.classList.toggle("has-buybar", show);
    }, { threshold: 0 }).observe(buy);
  }

  // related: same category first, then the best of everything else
  var track = $("[data-related]");
  if (track) {
    var same = PP.P.filter(function (x) { return x.cat === p.cat && x.id !== p.id; }).sort(function (a, b) { return (b.stock > 0) - (a.stock > 0) || (a.sub === p.sub ? -1 : 0) - (b.sub === p.sub ? -1 : 0) || a.rank - b.rank; });
    var rest = PP.P.filter(function (x) { return x.cat !== p.cat && x.stock > 0; }).sort(function (a, b) { return a.rank - b.rank; });
    var list = same.concat(rest).slice(0, 10);
    track.innerHTML = list.map(function (x) { return PP.card(x); }).join("");
    PP.initRail(track.closest("[data-rail]"));
  }
})();
