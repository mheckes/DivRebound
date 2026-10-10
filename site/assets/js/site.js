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

  // Die App setzt beim Start divrebound.lastVisit (siehe app/src/main.js).
  // Wer schon einmal in der App war, sieht im Header "Zurück zur App".
  try {
    if (cta && localStorage.getItem("divrebound.lastVisit")) {
      cta.textContent = cta.getAttribute("data-returning");
    }
  } catch (e) {
    // localStorage gesperrt (z.B. privater Modus mit strengen Einstellungen): Standardtext bleibt.
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
