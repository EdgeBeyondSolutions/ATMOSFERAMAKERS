(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var safe = function (fn, name) { try { fn(); } catch (e) { if (window.console) console.warn("[" + name + "]", e); } };

  root.classList.add("js");

  /* ------------------------------------------------------------
     Veil — the Atmosfera logo fades in when you leave a screen and
     fades out when the next one is ready. Not gated by reduced-motion:
     it is feedback for a click, not decoration.
     ------------------------------------------------------------ */
  var veil = $("#veil");
  var firstVisit = root.classList.contains("first");

  function markSeen() { try { sessionStorage.setItem("atm_seen", "1"); } catch (e) {} }

  function hideVeil() {
    if (!veil) return;
    veil.classList.remove("is-leaving");
    veil.classList.add("is-gone");
    veil.setAttribute("aria-hidden", "true");
    markSeen();
  }

  function initVeil() {
    if (!veil) return;
    var started = Date.now();
    var minShow = firstVisit ? 2300 : 450;

    var hero = $(".hero-slides img.is-active");
    var heroReady = new Promise(function (res) {
      if (!hero || hero.complete) return res();
      hero.addEventListener("load", res);
      hero.addEventListener("error", res);
    });
    var pageReady = new Promise(function (res) {
      if (doc.readyState === "complete") return res();
      window.addEventListener("load", res);
    });
    var cap = new Promise(function (res) { setTimeout(res, 4200); });

    Promise.race([Promise.all([heroReady, pageReady]), cap]).then(function () {
      var wait = Math.max(0, minShow - (Date.now() - started));
      setTimeout(hideVeil, wait);
    });

    // Leaving: fade the logo back in, then go.
    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!a || a.hasAttribute("data-lb") || a.hasAttribute("download") || a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      if (!/^(https?:|file:)$/.test(a.protocol)) return;
      if (a.host !== location.host) return;
      if (a.pathname === location.pathname && a.hash) return;
      e.preventDefault();
      root.classList.remove("menu-open");
      veil.setAttribute("aria-hidden", "false");
      veil.classList.remove("is-gone");
      veil.classList.add("is-leaving");
      setTimeout(function () { location.href = a.href; }, 560);
    });

    // Back/forward cache: never come back to a stuck veil.
    window.addEventListener("pageshow", function (e) { if (e.persisted) hideVeil(); });
  }

  /* ------------------------------------------------------------
     Header state, hero slides
     ------------------------------------------------------------ */
  function initHeader() {
    var header = $(".site-header");
    if (!header) return;
    var isHome = doc.body.classList.contains("page-home");
    var hero = $(".hero");
    function update() {
      var y = window.pageYOffset || root.scrollTop;
      header.classList.toggle("is-scrolled", y > 40);
      if (isHome && hero) doc.body.classList.toggle("past-hero", y > hero.offsetHeight * 0.72);
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initHero() {
    var imgs = $$(".hero-slides img");
    if (imgs.length < 2) return;
    var i = 0;
    setInterval(function () {
      if (doc.hidden) return;
      imgs[i].classList.remove("is-active");
      i = (i + 1) % imgs.length;
      imgs[i].classList.add("is-active");
    }, 7000);
  }

  /* ------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------ */
  function initMenu() {
    var btn = $(".menu-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var open = root.classList.toggle("menu-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root.classList.contains("menu-open")) {
        root.classList.remove("menu-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ------------------------------------------------------------
     Photographs appear once, when they enter the viewport.
     Failsafe: everything shows after 3.5 s even if observers fail.
     ------------------------------------------------------------ */
  function initReveal() {
    var items = $$("[data-reveal]");
    if (!items.length) return;
    function showAll() { items.forEach(function (el) { el.classList.add("in"); }); }
    if (!("IntersectionObserver" in window)) return showAll();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(showAll, 3500);
  }

  /* ------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------ */
  function initLightbox() {
    var triggers = $$("[data-lb]");
    if (!triggers.length) return;

    var lb = doc.createElement("div");
    lb.className = "lb";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Galería de proyecto");
    lb.innerHTML =
      '<div class="lb-stage"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>' +
      '<div class="lb-cap"></div>' +
      '<button type="button" class="lb-close" aria-label="Cerrar">Cerrar</button>' +
      '<button type="button" class="lb-prev" aria-label="Anterior">Anterior</button>' +
      '<button type="button" class="lb-next" aria-label="Siguiente">Siguiente</button>';
    doc.body.appendChild(lb);

    var img = $("img", lb), cap = $(".lb-cap", lb);
    var list = [], idx = 0, lastFocus = null, touchX = null;

    function galleryFor(el) {
      var raw = el.getAttribute("data-gallery");
      if (raw) { try { return JSON.parse(raw); } catch (e) {} }
      var scope = el.closest("[data-project]") || doc;
      return $$("[data-lb]", scope).map(function (n) {
        var im = $("img", n);
        return { src: n.getAttribute("data-full") || (im && im.getAttribute("src")), alt: im ? im.getAttribute("alt") : "", name: n.getAttribute("data-name") || "", loc: n.getAttribute("data-loc") || "" };
      });
    }

    function show(i, instant) {
      idx = (i + list.length) % list.length;
      var item = list[idx];
      function apply() {
        img.src = item.src; img.alt = item.alt || "";
        cap.innerHTML = "";
        var s = doc.createElement("strong"); s.textContent = item.name || "";
        cap.appendChild(s);
        cap.appendChild(doc.createTextNode(item.loc || ""));
        img.classList.remove("is-changing");
      }
      if (instant) return apply();
      img.classList.add("is-changing");
      setTimeout(apply, 280);
    }

    function open(el, startSrc) {
      list = galleryFor(el);
      var start = 0;
      list.forEach(function (it, i) { if (startSrc && it.src === startSrc) start = i; });
      lastFocus = doc.activeElement;
      show(start, true);
      var multi = list.length > 1;
      $(".lb-prev", lb).style.display = multi ? "" : "none";
      $(".lb-next", lb).style.display = multi ? "" : "none";
      lb.classList.add("is-open");
      root.style.overflow = "hidden";
      $(".lb-close", lb).focus();
    }
    function close() {
      lb.classList.remove("is-open");
      root.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    triggers.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var im = $("img", el);
        var src = el.getAttribute("data-full") || (im && im.getAttribute("src"));
        open(el, src);
      });
      if (el.tagName !== "A" && el.tagName !== "BUTTON") {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
        });
      }
    });

    $(".lb-close", lb).addEventListener("click", close);
    $(".lb-prev", lb).addEventListener("click", function () { show(idx - 1); });
    $(".lb-next", lb).addEventListener("click", function () { show(idx + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("lb-stage")) close(); });
    doc.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && list.length > 1) show(idx - 1);
      if (e.key === "ArrowRight" && list.length > 1) show(idx + 1);
    });
    lb.addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (touchX === null || list.length < 2) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
    }, { passive: true });
  }

  /* ------------------------------------------------------------
     Contact form — Formspree when configured, mailto otherwise
     ------------------------------------------------------------ */
  function initForm() {
    var form = $("#contact-form");
    if (!form) return;
    var status = $(".form-status", form);
    var action = form.getAttribute("action") || "";
    var configured = action.indexOf("YOUR_FORM_ID") === -1;
    var target = form.getAttribute("data-mailto") || "";

    function say(msg) { if (status) status.textContent = msg; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      if (data.get("_gotcha")) return;
      if (!configured) {
        var body = [
          "Nombre: " + (data.get("nombre") || ""),
          "Correo: " + (data.get("email") || ""),
          "Teléfono: " + (data.get("telefono") || ""),
          "Tipo de proyecto: " + (data.get("tipo") || ""),
          "", String(data.get("mensaje") || "")
        ].join("\n");
        location.href = "mailto:" + target + "?subject=" + encodeURIComponent("Cotización — sitio web") + "&body=" + encodeURIComponent(body);
        say("Abrimos tu programa de correo para que envíes el mensaje.");
        return;
      }
      say("Enviando…");
      fetch(action, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) throw new Error("bad status");
          form.reset();
          say("Gracias. Recibimos tu mensaje y te contactaremos pronto.");
        })
        .catch(function () {
          say("No se pudo enviar. Escríbenos a " + target + " o por WhatsApp.");
        });
    });
  }

  /* ------------------------------------------------------------ */
  safe(initVeil, "veil");
  safe(initHeader, "header");
  safe(initHero, "hero");
  safe(initMenu, "menu");
  safe(initReveal, "reveal");
  safe(initLightbox, "lightbox");
  safe(initForm, "form");
})();
