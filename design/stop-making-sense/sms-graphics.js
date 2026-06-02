(function () {
  /** Prefer graphics/vendor/*.svg when present; otherwise keep placeholder src from HTML. */
  var VENDOR = "graphics/vendor/";
  var FALLBACK = "graphics/";

  var FILES = {
    backdrop: "backdrop.svg",
    floor: "floor.svg",
    "amp-l": "amp-stack.svg",
    "amp-r": "amp-stack.svg",
    drums: "drums.svg",
    keys: "keys.svg",
    bass: "bass.svg",
    guitar: "guitar.svg",
    vocal: "vocal.svg",
    lights: "lights.svg",
    cables: "cables.svg",
    crowd: "crowd.svg",
    hall: "hall.svg",
  };

  var vendorCount = 0;

  function bindGraphic(img) {
    var key = img.getAttribute("data-graphic");
    var file = FILES[key];
    if (!file) return;

    var fallbackSrc = FALLBACK + file;
    var vendorSrc = VENDOR + file;

    function onVendorLoaded() {
      if (img.getAttribute("src") !== vendorSrc) return;
      img.classList.remove("sms-graphic--vendor-pending");
      img.classList.add("sms-graphic--vendor");
      vendorCount += 1;
      document.body.classList.add("sms-has-vendor-graphics");
      var credits = document.getElementById("sms-credits");
      if (credits) credits.hidden = false;
    }

    img.addEventListener("error", function () {
      if (img.getAttribute("src") === vendorSrc) {
        img.setAttribute("src", fallbackSrc);
        img.classList.remove("sms-graphic--vendor", "sms-graphic--vendor-pending");
      }
    });

    img.addEventListener("load", function () {
      if (img.getAttribute("src") === vendorSrc) onVendorLoaded();
    });

    var probe = new Image();
    probe.onload = function () {
      img.setAttribute("src", vendorSrc);
      img.classList.add("sms-graphic--vendor-pending");
      if (img.complete && img.getAttribute("src") === vendorSrc) onVendorLoaded();
    };
    probe.onerror = function () {
      if (img.getAttribute("src") !== fallbackSrc) img.setAttribute("src", fallbackSrc);
    };
    probe.src = vendorSrc;
  }

  document.querySelectorAll("img[data-graphic]").forEach(bindGraphic);
})();
