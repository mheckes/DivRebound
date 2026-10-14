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
})();
