// Website-Logik, bewusst minimal (keine Abhängigkeiten).

(function () {
  // Alte App-Links (vor dem Umzug nach /app/) lauteten .../DivRebound/#/dk/...
  // Solche Aufrufe landen jetzt auf der Startseite und werden in die App
  // weitergeleitet. Gleiche Origin, die IndexedDB-Daten bleiben erhalten.
  var cta = document.querySelector("[data-app-cta]");
  if (cta && /^#\//.test(location.hash)) {
    location.replace(cta.getAttribute("href") + location.hash);
    return;
  }

  // Europakarte: Hover verknüpft Land in der Karte, Beschriftung und Länderkarte.
  document.querySelectorAll("[data-c]").forEach(function (el) {
    var c = el.getAttribute("data-c");
    function set(on) {
      document.querySelectorAll('[data-c="' + c + '"]').forEach(function (x) {
        x.classList.toggle("hl", on);
      });
    }
    el.addEventListener("mouseenter", function () { set(true); });
    el.addEventListener("mouseleave", function () { set(false); });
  });

  // App-Vorschau: unter 820px bleibt die Desktop-Ansicht erhalten und wird
  // als Ganzes auf die Breite des Laptop-Rahmens verkleinert.
  var screen = document.querySelector(".mock-screen");
  var mock = screen && screen.querySelector(".app-mock");
  if (mock) {
    var narrow = window.matchMedia("(max-width: 820px)");
    function fitMock() {
      if (!narrow.matches) {
        mock.style.transform = "";
        screen.style.height = "";
        return;
      }
      var scale = screen.clientWidth / mock.offsetWidth;
      mock.style.transform = "scale(" + scale + ")";
      screen.style.height = mock.offsetHeight * scale + 16 + "px"; // + Rahmen oben/unten
    }
    window.addEventListener("resize", fitMock);
    fitMock();
  }

  // Lange Listen: auf dem Handy nur die ersten Einträge, Rest per Schalter.
  // Das Kürzen selbst macht site.css (nur unter 720px), ohne JS bleibt alles sichtbar.
  document.querySelectorAll("[data-collapse-mobile]").forEach(function (list) {
    var total = list.querySelectorAll('[role="row"]:not(.head)').length;
    if (total <= Number(list.getAttribute("data-collapse-mobile"))) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collapse-toggle";
    btn.setAttribute("aria-expanded", "false");
    function render(collapsed) {
      list.classList.toggle("is-collapsed", collapsed);
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.textContent = collapsed ? "Alle " + total + " Länder anzeigen ↓" : "Weniger anzeigen ↑";
    }
    btn.addEventListener("click", function () {
      var collapse = !list.classList.contains("is-collapsed");
      render(collapse);
      if (collapse) list.scrollIntoView({ block: "start" });
    });
    render(true);
    list.after(btn);
  });
})();
