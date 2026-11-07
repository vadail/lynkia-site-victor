/*
 * Bloques de Tienda y Contenido de esta web (diseño por bloques de Lynkia, 06-11-2026).
 *
 * Lo que va en cada bloque (que productos, cual se destaca, que informacion se ve y en cuantas columnas) se decide en
 * el editor y se guarda al publicar. Este script pide en cada visita los datos del momento (precio en la moneda de
 * quien visita, agotados, fechas) y los pinta en los huecos [data-lynkia-block]. En la vista previa del editor los
 * datos van dentro de la pagina (#lynkia-site-data) y no se pide nada.
 */
(function () {
  var ZERO = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf"];
  var THREE = ["bhd", "jod", "kwd", "omr", "tnd"];
  var preview = !!document.getElementById("lynkia-site-data");

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(cents, currency, locale) {
    var code = (currency || "eur").toLowerCase();
    var digits = ZERO.indexOf(code) >= 0 ? 0 : THREE.indexOf(code) >= 0 ? 3 : 2;
    var amount = (cents || 0) / Math.pow(10, digits);
    try {
      return amount.toLocaleString(locale === "en" ? "en-US" : "es-ES", {
        style: "currency",
        currency: code.toUpperCase(),
        minimumFractionDigits: amount % 1 === 0 ? 0 : digits,
        maximumFractionDigits: digits,
      });
    } catch (e) {
      return amount.toFixed(digits) + " " + code.toUpperCase();
    }
  }

  function when(iso, locale) {
    try {
      return new Date(iso).toLocaleString(locale === "en" ? "en-US" : "es-ES", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return "";
    }
  }

  function price(item, block, data) {
    if (!block.show.price) return "";
    if (item.free) return '<span class="lk-price">' + esc(data.texts.free) + "</span>";
    if (item.price_cents == null) return "";
    var old =
      block.show.compare_price !== false && item.compare_cents && item.compare_cents > item.price_cents
        ? "<s>" + esc(money(item.compare_cents, item.currency, data.locale)) + "</s>"
        : "";
    var from = item.price_from ? esc(data.texts.from) + " " : "";
    return '<span class="lk-price">' + old + from + esc(money(item.price_cents, item.currency, data.locale)) + "</span>";
  }

  function card(item, block, data, featured) {
    var media =
      '<div class="lk-card-media">' +
      (item.image ? '<img src="' + esc(item.image) + '" alt="" loading="lazy">' : "") +
      (featured ? '<span class="lk-badge">' + esc(data.texts.featured) + "</span>" : "") +
      (item.sold_out ? '<span class="lk-badge lk-badge-out">' + esc(data.texts.sold_out) + "</span>" : "") +
      "</div>";
    var meta = [];
    if (block.show.date && item.date) meta.push(when(item.date, data.locale));
    if (block.show.date && item.location) meta.push(item.location);
    var body =
      '<div class="lk-card-body">' +
      (item.kind_label ? '<span class="lk-card-kind">' + esc(item.kind_label) + "</span>" : "") +
      '<span class="lk-card-title">' + esc(item.title) + "</span>" +
      (meta.length ? '<span class="lk-card-meta">' + esc(meta.join(" · ")) + "</span>" : "") +
      (block.show.description && item.description ? '<span class="lk-card-desc">' + esc(item.description) + "</span>" : "") +
      '<span class="lk-card-foot">' +
      price(item, block, data) +
      (block.show.button && !item.sold_out ? '<span class="lk-btn">' + esc(block.button_label) + "</span>" : "") +
      "</span></div>";
    var target = preview ? ' target="_blank" rel="noopener"' : "";
    return '<a class="lk-card' + (featured ? " lk-featured" : "") + '" href="' + esc(item.url) + '"' + target + ">" + media + body + "</a>";
  }

  function render(data) {
    var byId = {};
    (data.blocks || []).forEach(function (b) {
      byId[b.id] = b;
    });
    var slots = document.querySelectorAll("[data-lynkia-block]");
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var block = byId[slot.getAttribute("data-lynkia-block")];
      if (!block) {
        // Un hueco que ya no esta en lo publicado (la web se edito a mano o con la IA despues): se oculta entero.
        var section = slot.closest ? slot.closest(".lk-block") : null;
        (section || slot).style.display = "none";
        continue;
      }
      var html = block.featured ? card(block.featured, block, data, true) : "";
      for (var j = 0; j < block.items.length; j++) html += card(block.items[j], block, data, false);
      slot.innerHTML = html || '<p class="lk-empty">' + esc(data.texts.empty) + "</p>";
    }
  }

  function clear() {
    var skeletons = document.querySelectorAll("[data-lynkia-block] .lk-skel");
    for (var i = 0; i < skeletons.length; i++) skeletons[i].parentNode.removeChild(skeletons[i]);
  }

  function start() {
    var inline = document.getElementById("lynkia-site-data");
    if (inline) {
      try {
        render(JSON.parse(inline.textContent));
      } catch (e) {
        clear();
      }
      return;
    }
    var cfgEl = document.getElementById("lynkia-site-config");
    if (!cfgEl || !window.fetch) return clear();
    var cfg = JSON.parse(cfgEl.textContent);
    // ?currency=usd en el enlace (desde una app o una campaña) fija la moneda durante esta visita.
    var match = /[?&]currency=([a-z]{3})/i.exec(window.location.search);
    var url = cfg.api + "/public/site/" + encodeURIComponent(cfg.handle) + (match ? "?currency=" + match[1].toLowerCase() : "");
    fetch(url)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && data.published) render(data);
        else clear();
      })
      .catch(clear);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
