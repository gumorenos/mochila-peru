(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function plural(n, one, many) { return n === 1 ? one : (many || one + "s"); }
  function clampNum(id) {
    var v = parseInt($("#" + id).value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function hash(str) {
    var h = 5381, i = str.length;
    while (i) h = (h * 33) ^ str.charCodeAt(--i);
    return "mochila-peru:" + (h >>> 0).toString(36);
  }
  function slug(s) {
    return s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var LABELS = {
    zones: {
      "lima-costa": "Lima / costa",
      "costa-norte": "Costa norte",
      sierra: "Sierra",
      selva: "Selva",
      "sur-volcanico": "Sur volcánico"
    },
    hazards: {
      sismo: "Sismo",
      tsunami: "Tsunami",
      huaico: "Huaico/deslizamiento",
      lluvias: "Lluvias/inundación",
      friaje: "Helada/friaje",
      ceniza: "Ceniza volcánica",
      incendio: "Incendio",
      corte: "Corte de agua/luz"
    },
    cats: {
      agua: "Agua y tratamiento",
      alimentos: "Alimentos",
      salud: "Salud y botiquín",
      comunicacion: "Comunicación",
      luz: "Energía y luz",
      seguridad: "Seguridad y herramientas",
      higiene: "Higiene",
      documentos: "Documentos y dinero",
      ropa: "Ropa y abrigo",
      bebes: "Bebés y niños",
      mayores: "Adultos mayores y movilidad",
      mascotas: "Mascotas",
      zona: "Riesgos de tu zona"
    }
  };

  var ZONE_HINTS = {
    "lima-costa": "Costa urbana: prioriza sismo, cortes de agua/luz y rutas de evacuación.",
    "costa-norte": "Costa norte: prepara lluvias intensas, inundaciones, zancudos y cortes prolongados.",
    sierra: "Sierra: agrega abrigo, protección contra heladas y rutas alternas por derrumbes.",
    selva: "Selva: refuerza agua segura, repelente, lluvias, humedad y aislamiento por crecida de ríos.",
    "sur-volcanico": "Sur volcánico: considera ceniza, sismo, frío nocturno y protección respiratoria."
  };

  var ZONE_PRESETS = {
    "lima-costa": ["sismo", "corte"],
    "costa-norte": ["sismo", "huaico", "lluvias", "corte"],
    sierra: ["sismo", "huaico", "friaje", "corte"],
    selva: ["lluvias", "corte"],
    "sur-volcanico": ["sismo", "ceniza", "friaje", "corte"]
  };

  var ICONS = {
    agua: "H2O",
    alimentos: "CAL",
    salud: "+",
    comunicacion: "SOS",
    luz: "W",
    seguridad: "!",
    higiene: "HI",
    documentos: "ID",
    ropa: "AB",
    bebes: "BB",
    mayores: "AM",
    mascotas: "PET",
    zona: "PE"
  };

  var checkedState = {};
  var expiryState = {};
  var currentKey = "";
  var storageOk = true;
  var currentPlan = null;
  var CONFIG_KEY = "mochila-peru:config";
  var OPTIONS_KEY = "mochila-peru:list-options";
  var ZONE_ORDER = ["lima-costa", "costa-norte", "sierra", "selva", "sur-volcanico"];
  var HAZARD_ORDER = ["sismo", "tsunami", "huaico", "lluvias", "friaje", "ceniza", "incendio", "corte"];
  var DAYS_ORDER = [3, 7, 14];
  var VIEW_ORDER = ["category", "priority"];
  var PRIORITY_ORDER = ["all", "crítico", "primero", "normal"];
  var SORT_ORDER = ["recommended", "priority", "expiry", "pending"];

  function priorityRank(priority) {
    if (priority === "crítico") return 0;
    if (priority === "primero") return 1;
    return 2;
  }

  function priorityTitle(priority) {
    if (priority === "crítico") return "Crítico";
    if (priority === "primero") return "Primero";
    return "Complementario";
  }

  function readConfig() {
    var hazards = {};
    $$("input[name=hazard]").forEach(function (c) { hazards[c.value] = c.checked; });
    return {
      zone: ($("input[name=zone]:checked") || {}).value || "lima-costa",
      hazards: hazards,
      adults: clampNum("adults"),
      children: clampNum("children"),
      infants: clampNum("infants"),
      elderly: clampNum("elderly"),
      pets: clampNum("pets"),
      meds: $("input[name=meds]").checked,
      mobility: $("input[name=mobility]").checked,
      apartment: $("input[name=apartment]").checked,
      days: parseInt(($("input[name=days]:checked") || {}).value || "3", 10)
    };
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    var zone = cfg.zone || "lima-costa";
    var zoneInput = $("input[name=zone][value='" + zone + "']");
    if (zoneInput) zoneInput.checked = true;
    $$("input[name=hazard]").forEach(function (c) {
      c.checked = !!(cfg.hazards && cfg.hazards[c.value]);
    });
    ["adults", "children", "infants", "elderly", "pets"].forEach(function (id) {
      if (cfg[id] != null) $("#" + id).value = cfg[id];
    });
    $("input[name=meds]").checked = !!cfg.meds;
    $("input[name=mobility]").checked = !!cfg.mobility;
    $("input[name=apartment]").checked = !!cfg.apartment;
    var daysInput = $("input[name=days][value='" + (cfg.days || 3) + "']");
    if (daysInput) daysInput.checked = true;
  }

  function loadConfig() {
    if (!storageOk) return null;
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveConfig() {
    if (!storageOk) return;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(readConfig()));
    } catch (e) {
      storageOk = false;
    }
  }

  function applyListOptions(opts) {
    if (!opts) return;
    var viewInput = $("input[name=viewMode][value='" + (opts.view || "category") + "']");
    if (viewInput) viewInput.checked = true;
    if (opts.priority && $("#priorityFilter")) $("#priorityFilter").value = opts.priority;
    if (opts.sort && $("#sortMode")) $("#sortMode").value = opts.sort;
  }

  function loadListOptions() {
    if (!storageOk) return null;
    try {
      return JSON.parse(localStorage.getItem(OPTIONS_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveListOptions() {
    if (!storageOk) return;
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(listOptions()));
    } catch (e) {
      storageOk = false;
    }
  }

  function applyZonePreset(zone) {
    var preset = ZONE_PRESETS[zone] || ZONE_PRESETS["lima-costa"];
    $$("input[name=hazard]").forEach(function (c) {
      c.checked = preset.indexOf(c.value) !== -1;
    });
  }

  function configKey(cfg) {
    return hash(JSON.stringify([
      cfg.zone, cfg.days, cfg.adults, cfg.children, cfg.infants, cfg.elderly, cfg.pets,
      cfg.meds, cfg.mobility, cfg.apartment, cfg.hazards.sismo, cfg.hazards.tsunami,
      cfg.hazards.huaico, cfg.hazards.lluvias, cfg.hazards.friaje, cfg.hazards.ceniza,
      cfg.hazards.incendio, cfg.hazards.corte
    ]));
  }

  function loadChecks(key) {
    checkedState = {};
    expiryState = {};
    if (!storageOk) return;
    try {
      checkedState = JSON.parse(localStorage.getItem(key) || "{}") || {};
      expiryState = JSON.parse(localStorage.getItem(key + ":expiry") || "{}") || {};
    } catch (e) {
      checkedState = {};
      expiryState = {};
    }
  }

  function saveChecks() {
    if (!storageOk) return;
    try {
      localStorage.setItem(currentKey, JSON.stringify(checkedState));
    } catch (e) {
      storageOk = false;
    }
  }

  function saveExpiry() {
    if (!storageOk) return;
    try {
      localStorage.setItem(currentKey + ":expiry", JSON.stringify(expiryState));
    } catch (e) {
      storageOk = false;
    }
  }

  function base64UrlEncode(text) {
    return btoa(unescape(encodeURIComponent(text)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecode(text) {
    var normalized = text.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    return decodeURIComponent(escape(atob(normalized)));
  }

  function to36(n) {
    return Math.max(0, Number(n) || 0).toString(36);
  }

  function from36(text) {
    var n = parseInt(text || "0", 36);
    return isNaN(n) ? 0 : n;
  }

  function indexOrZero(list, value) {
    var idx = list.indexOf(value);
    return idx < 0 ? 0 : idx;
  }

  function indexesToBits(indexes) {
    var bits = 0n;
    indexes.forEach(function (idx) {
      bits |= 1n << BigInt(idx);
    });
    return bits.toString(36);
  }

  function bitsToIndexes(text) {
    var value = 0n;
    (text || "0").toLowerCase().split("").forEach(function (ch) {
      value = value * 36n + BigInt(parseInt(ch, 36) || 0);
    });
    var out = [];
    var idx = 0;
    while (value > 0n) {
      if (value & 1n) out.push(idx);
      value >>= 1n;
      idx += 1;
    }
    return out;
  }

  function dateToCode(dateText) {
    var parts = (dateText || "").split("-");
    if (parts.length !== 3) return "";
    var base = Date.UTC(2026, 0, 1);
    var date = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return to36(Math.round((date - base) / 86400000));
  }

  function codeToDate(code) {
    var base = Date.UTC(2026, 0, 1);
    var date = new Date(base + from36(code) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function sharedPayload() {
    var items = currentPlan ? flatItems(currentPlan) : [];
    var indexById = {};
    items.forEach(function (it, idx) { indexById[it.id] = idx; });
    var checked = Object.keys(checkedState).filter(function (id) {
      return checkedState[id] && indexById[id] != null;
    }).map(function (id) { return indexById[id]; });
    var expiry = Object.keys(expiryState).filter(function (id) {
      return expiryState[id] && indexById[id] != null;
    }).map(function (id) { return [indexById[id], expiryState[id]]; });
    return {
      v: 1,
      cfg: readConfig(),
      opts: listOptions(),
      checked: checked,
      expiry: expiry
    };
  }

  function shareUrl() {
    var url = new URL(window.location.href);
    url.search = "";
    url.hash = "l=" + compactShareCode();
    return url.toString();
  }

  function readSharedPayload() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#l=") === 0) return readCompactShareCode(hash.slice(3));
    var raw = new URLSearchParams(window.location.search).get("lista");
    if (!raw) return null;
    try {
      var payload = JSON.parse(base64UrlDecode(raw));
      return payload && payload.v === 1 ? payload : null;
    } catch (e) {
      return null;
    }
  }

  function compactShareCode() {
    var payload = sharedPayload();
    var cfg = payload.cfg;
    var opts = payload.opts;
    var hazards = HAZARD_ORDER.reduce(function (mask, key, idx) {
      return cfg.hazards[key] ? mask + Math.pow(2, idx) : mask;
    }, 0);
    var flags = (cfg.meds ? 1 : 0) + (cfg.mobility ? 2 : 0) + (cfg.apartment ? 4 : 0);
    var head = [
      2,
      indexOrZero(ZONE_ORDER, cfg.zone),
      hazards,
      cfg.adults,
      cfg.children,
      cfg.infants,
      cfg.elderly,
      cfg.pets,
      flags,
      indexOrZero(DAYS_ORDER, cfg.days),
      indexOrZero(VIEW_ORDER, opts.view),
      indexOrZero(PRIORITY_ORDER, opts.priority),
      indexOrZero(SORT_ORDER, opts.sort)
    ].map(to36).join(".");
    var expiry = payload.expiry.map(function (pair) {
      return to36(pair[0]) + "-" + dateToCode(pair[1]);
    }).filter(function (part) { return part.slice(-1) !== "-"; }).join("_");
    return [head, indexesToBits(payload.checked), expiry || "-"].join(".");
  }

  function readCompactShareCode(code) {
    var parts = (code || "").split(".");
    if (parts.length < 15 || from36(parts[0]) !== 2) return null;
    var flags = from36(parts[8]);
    var hazardsMask = from36(parts[2]);
    var hazards = {};
    HAZARD_ORDER.forEach(function (key, idx) {
      hazards[key] = !!(hazardsMask & Math.pow(2, idx));
    });
    var expiry = parts[14] === "-" ? [] : (parts[14] || "").split("_").map(function (entry) {
      var pair = entry.split("-");
      return [from36(pair[0]), codeToDate(pair[1])];
    });
    return {
      v: 1,
      cfg: {
        zone: ZONE_ORDER[from36(parts[1])] || "lima-costa",
        hazards: hazards,
        adults: from36(parts[3]),
        children: from36(parts[4]),
        infants: from36(parts[5]),
        elderly: from36(parts[6]),
        pets: from36(parts[7]),
        meds: !!(flags & 1),
        mobility: !!(flags & 2),
        apartment: !!(flags & 4),
        days: DAYS_ORDER[from36(parts[9])] || 3
      },
      opts: {
        view: VIEW_ORDER[from36(parts[10])] || "category",
        priority: PRIORITY_ORDER[from36(parts[11])] || "all",
        sort: SORT_ORDER[from36(parts[12])] || "recommended"
      },
      checked: bitsToIndexes(parts[13]),
      expiry: expiry
    };
  }

  function applySharedState(payload) {
    if (!payload || !currentPlan) return;
    var items = flatItems(currentPlan);
    checkedState = {};
    expiryState = {};
    (payload.checked || []).forEach(function (idx) {
      if (items[idx]) checkedState[items[idx].id] = true;
    });
    (payload.expiry || []).forEach(function (pair) {
      if (items[pair[0]] && pair[1]) expiryState[items[pair[0]].id] = pair[1];
    });
    saveChecks();
    saveExpiry();
    renderChecklist(currentPlan);
  }

  function writeClipboard(text, button, doneText) {
    var original = button.textContent;
    function done() {
      button.textContent = doneText;
      setTimeout(function () { button.textContent = original; }, 1600);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () {
        window.prompt("Copia este texto:", text);
        done();
      });
      return;
    }
    window.prompt("Copia este texto:", text);
    done();
  }

  function escapeHtml(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function daysUntil(dateText) {
    if (!dateText) return null;
    var parts = dateText.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function expiryText(dateText) {
    var days = daysUntil(dateText);
    if (days == null) return "Sin fecha";
    if (days < 0) return "Vencido hace " + Math.abs(days) + " " + plural(Math.abs(days), "día");
    if (days === 0) return "Vence hoy";
    if (days <= 30) return "Vence en " + days + " " + plural(days, "día");
    return "Vence en " + days + " " + plural(days, "día");
  }

  function expiryClass(dateText) {
    var days = daysUntil(dateText);
    if (days == null) return "";
    if (days < 0) return "is-expired";
    if (days <= 30) return "is-soon";
    if (days <= 90) return "is-watch";
    return "is-ok";
  }

  function buildPlan(cfg) {
    var people = cfg.adults + cfg.children + cfg.infants + cfg.elderly;
    var days = cfg.days;
    var personDays = people * days;
    var waterL = Math.max(0, people * days * 4);
    var cats = [];

    function cat(id, items) {
      var real = items.filter(Boolean).map(function (entry, idx) {
        entry.id = id + "-" + idx + "-" + slug(entry.name);
        entry.catId = id;
        entry.catTitle = LABELS.cats[id];
        entry.order = cats.reduce(function (sum, c) { return sum + c.items.length; }, 0) + idx;
        return entry;
      });
      if (real.length) cats.push({ id: id, title: LABELS.cats[id], items: real });
    }
    function item(name, qty, why, priority, dateLabel) {
      return { name: name, qty: qty, why: why, priority: priority || "", dateLabel: dateLabel || "" };
    }

    cat("agua", [
      people > 0 && item("Agua para beber e higiene básica", waterL + " L", "Referencia práctica: 4 L por persona por día para beber, cocinar simple y lavarse lo mínimo.", "crítico", "Vence"),
      item("Bidones o galoneras cerradas", Math.max(2, Math.ceil(waterL / 20)) + " de 20 L", "El agua sirve de poco si no está almacenada en envases limpios, cerrados y fáciles de mover.", "primero", "Revisar"),
      item("Pastillas potabilizadoras o lejía sin perfume", cfg.hazards.lluvias || cfg.hazards.huaico ? "1 caja + gotero" : "1 caja", "Tras lluvias, huaicos o cortes, el agua puede contaminarse aunque se vea clara.", "primero", "Vence"),
      item("Botellas chicas para evacuar", Math.max(people, 1) + " unidades", "Sirven para salir rápido sin cargar todo el bidón.")
    ]);

    cat("alimentos", [
      people > 0 && item("Alimentos listos para comer", personDays + " persona-días", "Conservas, galletas, frutos secos, avena instantánea o comida que no dependa de refrigeración.", "primero", "Vence"),
      item("Abrelatas manual", "1", "Parece obvio hasta que todas las latas esperan y no hay luz. Clásico peruano.", "primero"),
      item("Cubiertos, platos y vasos reutilizables", Math.max(people, 1) + " juegos", "Reduce residuos y evita comer directo de envases sucios."),
      item("Sal, azúcar y sobres de bebida", "1 bolsa pequeña", "Ayudan a mantener energía y hacer tolerable la comida de emergencia.", "", "Vence")
    ]);

    cat("salud", [
      item("Botiquín familiar completo", "1", "Gasas, vendas, curitas, antiséptico, guantes, tijera, esparadrapo y suero fisiológico.", "crítico", "Revisar"),
      item("Paracetamol o ibuprofeno", "1 caja", "Dolor y fiebre son comunes cuando no hay atención inmediata.", "primero", "Vence"),
      item("Sales de rehidratación oral", Math.max(people * 2, 2) + " sobres", "La deshidratación por diarrea, calor o mala agua puede complicarse rápido.", "primero", "Vence"),
      item("Alcohol, jabón o gel desinfectante", "1 set", "Previene infecciones cuando el agua limpia escasea.", "", "Vence"),
      cfg.meds && item("Medicamentos diarios", "7 días o más", "Guarda dosis extra, receta o foto de receta, y nombre genérico del medicamento.", "crítico", "Vence"),
      item("Teléfonos de emergencia impresos", "1 tarjeta", "Bomberos 116, Policía 105, SAMU 106, emergencias 911 donde aplique, familia y vecinos.", "primero")
    ]);

    cat("comunicacion", [
      item("Radio a pilas o manivela", "1", "Cuando internet cae, las indicaciones oficiales llegan por radio.", "crítico", "Probar"),
      item("Silbato", Math.max(people, 1), "Tres pitidos ayudan a ubicarte si quedas atrapado o separado.", "crítico"),
      item("Lista impresa de contactos y punto de reunión", "1 por familia", "Define antes donde se encuentran si los teléfonos no funcionan.", "primero"),
      item("Mapa simple de rutas seguras", "1", "Marca salida del edificio, zona alta si hay tsunami y centro de reunión vecinal.")
    ]);

    cat("luz", [
      item("Linterna o frontal", Math.max(cfg.adults + cfg.elderly, 1), "Luz de manos libres para escaleras, vidrios rotos o evacuación nocturna.", "crítico", "Probar"),
      item("Pilas de repuesto", "2 juegos", "Las pilas mueren en el peor momento, con una puntualidad casi artística.", "primero", "Vence"),
      item("Power bank cargado", people <= 2 ? "1 de 10,000 mAh" : "2 de 10,000 mAh", "Mantiene vivo al menos un celular para llamadas y alertas.", "primero", "Recargar"),
      cfg.hazards.corte && item("Cargador solar o de auto", "1", "Útil si el corte dura varios días o estás aislado.", "", "Probar")
    ]);

    cat("seguridad", [
      item("Guantes de trabajo", Math.max(cfg.adults, 1) + " pares", "Para mover vidrio, metal, madera y escombros sin cortarte.", "primero"),
      item("Navaja multiuso", "1", "Sirve para abrir, cortar, ajustar y reparar cosas pequeñas."),
      item("Cinta americana y cuerda", "1 rollo + 10 m", "Improvisa cierres, amarras, reparaciones y señalización."),
      cfg.hazards.sismo && item("Zapatillas cerradas junto a la cama", Math.max(people, 1) + " pares", "Después de un sismo el piso puede quedar con vidrios y objetos filudos.", "primero"),
      cfg.hazards.incendio && item("Extintor ABC revisado", "1", "Un fuego pequeño se puede controlar antes de que cierre la salida.", "crítico", "Revisar"),
      cfg.apartment && item("Llaves y plan de evacuación del edificio", "1 set", "Identifica escaleras, punto de reunión y quien ayuda a vecinos vulnerables.")
    ]);

    cat("higiene", [
      item("Papel higiénico, pañitos y bolsas gruesas", days + " días", "Sanidad básica si el agua o desagüe falla."),
      item("Mascarillas", Math.max(people * 3, 3), "Polvo, humo, escombros, ceniza o refugios concurridos."),
      item("Toallas higiénicas o productos menstruales", "según hogar", "Es de lo primero que falta y de lo último que se recuerda."),
      item("Repelente y bloqueador", cfg.zone === "selva" || cfg.zone === "costa-norte" ? "1 por adulto" : "1", "Zancudos, sol y esperas largas no piden permiso.", "", "Vence"),
      item("Bolsas herméticas", "varias", "Separan basura, ropa mojada, documentos y medicinas.")
    ]);

    cat("documentos", [
      item("DNI y copias en bolsa impermeable", "1 pouch", "Incluye DNI, partidas, títulos, seguros, recetas, carnets de vacunación y contactos.", "crítico"),
      item("Efectivo en billetes pequeños", "S/ según hogar", "Si no hay luz, POS, ATM, Yape o Plin pueden no servir.", "primero"),
      item("USB o memoria con documentos escaneados", "1", "Backup rápido si pierdes papeles físicos."),
      item("Llaves duplicadas", "1 juego", "Casa, auto, candados o depósito de emergencia.")
    ]);

    cat("ropa", [
      item("Muda de ropa", Math.max(people, 1) + " sets", "Ropa seca evita frío, irritaciones y problemas de piel."),
      item("Manta térmica o frazada ligera", Math.max(people, 1), "El frío llega incluso en costa si estás mojado o en shock.", "primero"),
      (cfg.hazards.friaje || cfg.zone === "sierra" || cfg.zone === "sur-volcanico") && item("Abrigo extra, gorro y medias", Math.max(people, 1) + " sets", "Heladas, friaje y noches altoandinas pueden ser más peligrosas que el hambre.", "crítico"),
      (cfg.hazards.lluvias || cfg.zone === "selva" || cfg.zone === "costa-norte") && item("Poncho impermeable o casaca de lluvia", Math.max(people, 1), "Permite evacuar o hacer cola sin empaparte.")
    ]);

    cat("bebes", [
      cfg.infants > 0 && item("Pañales", cfg.infants * days * 6 + " unidades", "Cálculo simple: 6 pañales por bebé por día.", "primero", "Revisar"),
      cfg.infants > 0 && item("Fórmula o alimento de bebé", days + " días", "Usa lo que el bebé ya tolera; no experimentes en emergencia.", "crítico", "Vence"),
      cfg.infants > 0 && item("Pañitos, crema y bolsas", "1 set", "Higiene rápida sin agua corriente."),
      cfg.children > 0 && item("Snacks y objeto de calma", cfg.children + " " + plural(cfg.children, "set"), "Ayuda a que los niños cooperen durante esperas largas.")
    ]);

    cat("mayores", [
      cfg.elderly > 0 && item("Lentes, audífonos o baterías extra", "1 set", "Perder autonomía en evacuación aumenta el riesgo.", "primero", "Revisar"),
      cfg.mobility && item("Bastón, andador o repuestos", "1 set", "La evacuación debe funcionar con cortes de luz y escaleras.", "crítico"),
      (cfg.elderly > 0 || cfg.meds) && item("Ficha médica impresa", "1 por persona", "Alergias, diagnósticos, medicinas, dosis y contactos.")
    ]);

    cat("mascotas", [
      cfg.pets > 0 && item("Comida para mascota", cfg.pets * days + " mascota-días", "Usa su alimento habitual para evitar problemas digestivos.", "primero", "Vence"),
      cfg.pets > 0 && item("Agua extra para mascota", cfg.pets * days + " L", "No debe beber agua de acequias, charcos o inundación.", "primero"),
      cfg.pets > 0 && item("Correa, placa y transportador", cfg.pets + " sets", "Facilita evacuar y entrar a albergues o casas de familiares."),
      cfg.pets > 0 && item("Vacunas o datos veterinarios", "1 copia", "Puede ser necesario para recibirlos en refugios o traslados.")
    ]);

    cat("zona", [
      cfg.hazards.tsunami && item("Ruta a zona alta", "1 mapa marcado", "Si estás en costa, evacúa a pie hacia zona alta después de sismo fuerte o alerta.", "crítico"),
      cfg.hazards.huaico && item("Ruta alterna fuera de quebradas", "1 plan", "No cruces cauces activos; identifica salida por zonas altas o seguras.", "crítico"),
      cfg.hazards.lluvias && item("Botas o calzado impermeable", Math.max(cfg.adults, 1) + " pares", "Agua estancada trae cortes, infecciones y cables caídos.", "primero"),
      cfg.hazards.ceniza && item("Respiradores N95 y lentes cerrados", Math.max(people * 4, 4) + " mascarillas", "La ceniza volcánica irrita pulmones y ojos; no basta una tela.", "crítico", "Revisar"),
      cfg.hazards.friaje && item("Termo y bebidas calientes", "1 set", "En friaje o helada, conservar temperatura corporal es prioridad."),
      cfg.zone === "selva" && item("Mosquitero liviano", "1", "Reduce picaduras si debes dormir fuera o con ventanas abiertas.")
    ]);

    return { cats: cats, meta: { people: people, waterL: waterL, personDays: personDays } };
  }

  function renderSummary(cfg, meta) {
    var hazards = Object.keys(cfg.hazards).filter(function (k) { return cfg.hazards[k]; })
      .map(function (k) { return LABELS.hazards[k]; });
    $("#summary").innerHTML =
      '<div class="summary__bar">' +
      '<p><strong>' + (meta.people || 0) + ' personas</strong> - ' + cfg.days + ' días - ' + LABELS.zones[cfg.zone] + '</p>' +
      '<p>Agua objetivo: <strong>' + meta.waterL + ' L</strong> - comida: <strong>' + meta.personDays + ' persona-días</strong></p>' +
      '<p>Riesgos: ' + (hazards.join(", ") || "ninguno seleccionado") + '</p>' +
      '</div>';
  }

  function checkedCount(items) {
    return items.filter(function (it) { return checkedState[it.id]; }).length;
  }

  function summaryText() {
    var cfg = readConfig();
    var items = currentPlan ? flatItems(currentPlan) : [];
    var done = checkedCount(items);
    var hazards = Object.keys(cfg.hazards).filter(function (k) { return cfg.hazards[k]; })
      .map(function (k) { return LABELS.hazards[k]; });
    var pending = items.filter(function (it) { return !checkedState[it.id]; })
      .sort(function (a, b) {
        var pr = priorityRank(a.priority) - priorityRank(b.priority);
        return pr || a.order - b.order;
      })
      .slice(0, 14)
      .map(function (it) {
        return "- " + it.name + (it.qty ? " (" + it.qty + ")" : "") + " - " + it.catTitle;
      });
    return [
      "Mochila Perú",
      LABELS.zones[cfg.zone] + " - " + (currentPlan ? currentPlan.meta.people : 0) + " personas - " + cfg.days + " días",
      "Riesgos: " + (hazards.join(", ") || "ninguno seleccionado"),
      "Avance: " + done + " de " + items.length + " artículos",
      "",
      "Pendientes prioritarios:",
      pending.length ? pending.join("\n") : "- Todo marcado como listo",
      "",
      "Lista editable: " + shareUrl()
    ].join("\n");
  }

  function printableSnapshot() {
    var cfg = readConfig();
    var plan = currentPlan || buildPlan(cfg);
    var items = flatItems(plan);
    var done = checkedCount(items);
    var hazards = Object.keys(cfg.hazards).filter(function (k) { return cfg.hazards[k]; })
      .map(function (k) { return LABELS.hazards[k]; });
    return {
      title: "Mochila Perú",
      zone: LABELS.zones[cfg.zone],
      people: plan.meta.people,
      days: cfg.days,
      done: done,
      total: items.length,
      waterL: plan.meta.waterL,
      hazards: hazards,
      categories: plan.cats.map(function (cat) {
        return {
          title: cat.title,
          items: cat.items.map(function (it) {
            return {
              ready: checkedState[it.id] ? "Listo" : "Pendiente",
              name: it.name,
              qty: it.qty || "",
              priority: it.priority ? priorityTitle(it.priority) : "",
              date: it.dateLabel ? (it.dateLabel + ": " + (expiryState[it.id] || "sin fecha")) : "",
              why: it.why
            };
          })
        };
      }),
      note: "Uso orientativo. Contrasta siempre con indicaciones oficiales de INDECI, COEN, SENAMHI, IGP, CENEPRED, Minsa, Bomberos y tu municipalidad."
    };
  }

  async function downloadPdf(button) {
    var original = button.textContent;
    var snapshot = printableSnapshot();
    if (window.MochilaPdf && window.MochilaPdf.save) {
      button.textContent = "Generando...";
      try {
        await window.MochilaPdf.save(snapshot);
        button.textContent = "PDF listo";
      } catch (e) {
        button.textContent = "Cancelado";
      }
      setTimeout(function () { button.textContent = original; }, 1600);
      return;
    }

    try {
      localStorage.setItem("mochila-peru:print-snapshot", JSON.stringify(snapshot));
    } catch (e) {
      button.textContent = "Sin storage";
      setTimeout(function () { button.textContent = original; }, 1800);
      return;
    }

    var pdfUrl = new URL("pdf.html", window.location.href);
    pdfUrl.search = "v=" + Date.now().toString(36);
    var win = window.open(pdfUrl.toString(), "_blank");
    if (!win) {
      button.textContent = "Permite ventanas";
      setTimeout(function () { button.textContent = original; }, 1800);
      return;
    }
    button.textContent = "Vista PDF";
    setTimeout(function () { button.textContent = original; }, 1600);
  }

  function listOptions() {
    return {
      view: ($("input[name=viewMode]:checked") || {}).value || "category",
      priority: ($("#priorityFilter") || {}).value || "all",
      sort: ($("#sortMode") || {}).value || "recommended"
    };
  }

  function filterItems(items, opts) {
    return items.filter(function (it) {
      if (opts.priority === "all") return true;
      if (opts.priority === "normal") return !it.priority;
      return it.priority === opts.priority;
    });
  }

  function sortItems(items, opts) {
    var list = items.slice();
    list.sort(function (a, b) {
      if (opts.sort === "priority" || opts.view === "priority") {
        var pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr) return pr;
      }
      if (opts.sort === "expiry") {
        var ad = daysUntil(expiryState[a.id]);
        var bd = daysUntil(expiryState[b.id]);
        if (!a.dateLabel && b.dateLabel) return 1;
        if (a.dateLabel && !b.dateLabel) return -1;
        if (ad == null && bd != null) return 1;
        if (ad != null && bd == null) return -1;
        if (ad != null && bd != null && ad !== bd) return ad - bd;
      }
      if (opts.sort === "pending") {
        var ac = checkedState[a.id] ? 1 : 0;
        var bc = checkedState[b.id] ? 1 : 0;
        if (ac !== bc) return ac - bc;
      }
      return a.order - b.order;
    });
    return list;
  }

  function flatItems(plan) {
    return plan.cats.reduce(function (all, c) { return all.concat(c.items); }, []);
  }

  function renderItem(it) {
    var id = it.id;
    var li = el("li", "item");
    if (checkedState[id]) li.classList.add("is-done");

    var input = el("input");
    input.type = "checkbox";
    input.checked = !!checkedState[id];
    input.id = "chk-" + id;
    input.addEventListener("change", function () {
      checkedState[id] = input.checked;
      li.classList.toggle("is-done", input.checked);
      saveChecks();
      updateMeter();
    });

    var box = el("span", "item__box");
    box.appendChild(input);
    li.appendChild(box);

    var label = el("label", "item__main");
    label.setAttribute("for", input.id);
    label.appendChild(el("span", "item__name", it.name));
    if (it.qty) label.appendChild(el("span", "item__qty", it.qty));
    if (it.priority === "crítico") label.appendChild(el("span", "tag tag--critical", "crítico"));
    if (it.priority === "primero") label.appendChild(el("span", "tag tag--first", "primero"));
    if (listOptions().view === "priority") label.appendChild(el("span", "tag tag--cat", it.catTitle));
    li.appendChild(label);
    li.appendChild(el("p", "item__why", it.why));

    if (!it.dateLabel) return li;

    var expiry = el("div", "item__expiry");
    var expiryLabel = el("label", null, it.dateLabel);
    var expiryInput = el("input");
    expiryInput.type = "date";
    expiryInput.id = "exp-" + id;
    expiryInput.name = "expiry-" + id;
    expiryInput.value = expiryState[id] || "";
    expiryInput.setAttribute("aria-label", "Fecha para " + it.dateLabel.toLowerCase() + " " + it.name);
    var expiryStatus = el("span", "expiry-status", expiryText(expiryInput.value));
    var statusClass = expiryClass(expiryInput.value);
    if (statusClass) expiryStatus.classList.add(statusClass);
    expiryInput.addEventListener("change", function () {
      if (expiryInput.value) expiryState[id] = expiryInput.value;
      else delete expiryState[id];
      expiryStatus.textContent = expiryText(expiryInput.value);
      expiryStatus.className = "expiry-status";
      var cls = expiryClass(expiryInput.value);
      if (cls) expiryStatus.classList.add(cls);
      saveExpiry();
      updateMeter();
    });
    expiryLabel.setAttribute("for", expiryInput.id);
    expiryLabel.appendChild(expiryInput);
    expiry.appendChild(expiryLabel);
    expiry.appendChild(expiryStatus);
    li.appendChild(expiry);
    return li;
  }

  function renderCategory(c, items) {
    var section = el("section", "cat");
    var head = el("div", "cat__head");
    head.appendChild(el("span", "cat__glyph", ICONS[c.id] || "PE"));
    head.appendChild(el("h3", null, c.title));
    head.appendChild(el("span", "cat__count"));
    section.appendChild(head);

    var list = el("ul", "cat__list");
    items.forEach(function (it) { list.appendChild(renderItem(it)); });
    section.appendChild(list);
    return section;
  }

  function renderChecklist(plan) {
    var root = $("#checklist");
    var opts = listOptions();
    root.innerHTML = "";
    if (opts.view === "priority") {
      root.classList.add("kit--priority");
      ["crítico", "primero", ""].forEach(function (priority) {
        var items = sortItems(filterItems(flatItems(plan), opts), opts)
          .filter(function (it) { return (it.priority || "") === priority; });
        if (!items.length) return;
        root.appendChild(renderCategory({
          id: priority === "crítico" ? "seguridad" : priority === "primero" ? "documentos" : "zona",
          title: priorityTitle(priority)
        }, items));
      });
    } else {
      root.classList.remove("kit--priority");
      plan.cats.forEach(function (c) {
        var items = sortItems(filterItems(c.items, opts), opts);
        if (items.length) root.appendChild(renderCategory(c, items));
      });
    }
    if (!root.children.length) {
      root.appendChild(el("p", "empty", "No hay artículos para ese filtro."));
    }
    updateMeter();
  }

  function updateMeter() {
    var boxes = $$("#checklist input[type=checkbox]");
    var done = boxes.filter(function (b) { return b.checked; }).length;
    var total = boxes.length;
    var pct = total ? Math.round(done * 100 / total) : 0;
    $("#meterFill").style.width = pct + "%";
    $("#meterPct").textContent = pct + "%";
    $("#meterCount").textContent = done + " de " + total;
    $$(".cat").forEach(function (card) {
      var all = $$("input[type=checkbox]", card);
      var ok = all.filter(function (b) { return b.checked; }).length;
      $(".cat__count", card).textContent = ok + "/" + all.length;
    });
    updateExpirySummary();
  }

  function updateExpirySummary() {
    var trackable = currentPlan ? flatItems(currentPlan).filter(function (it) { return it.dateLabel; }) : [];
    var dates = trackable.map(function (it) { return expiryState[it.id]; }).filter(Boolean);
    var expired = 0;
    var soon = 0;
    var watch = 0;
    dates.forEach(function (dateText) {
      var days = daysUntil(dateText);
      if (days == null) return;
      if (days < 0) expired += 1;
      else if (days <= 30) soon += 1;
      else if (days <= 90) watch += 1;
    });
    var target = $("#expirySummary");
    if (!target) return;
    if (!dates.length) {
      target.textContent = "Sin fechas de rotación registradas.";
      target.className = "expiry-summary";
      return;
    }
    target.textContent = dates.length + " " + plural(dates.length, "fecha registrada", "fechas registradas") +
      " - " + expired + " " + plural(expired, "vencido", "vencidos") +
      " - " + soon + " por vencer en 30 días" +
      " - " + watch + " en observación.";
    target.className = "expiry-summary";
    if (expired) target.classList.add("is-expired");
    else if (soon) target.classList.add("is-soon");
    else if (watch) target.classList.add("is-watch");
    else target.classList.add("is-ok");
  }

  function updateZoneHint() {
    var cfg = readConfig();
    $("#zoneHint").textContent = ZONE_HINTS[cfg.zone] || "";
  }

  function build(preserveChecks) {
    var cfg = readConfig();
    var key = configKey(cfg);
    if (!preserveChecks || key !== currentKey) {
      currentKey = key;
      loadChecks(key);
    }
    var plan = buildPlan(cfg);
    currentPlan = plan;
    renderSummary(cfg, plan.meta);
    renderChecklist(plan);
  }

  function refreshListOnly() {
    saveListOptions();
    if (currentPlan) renderChecklist(currentPlan);
  }

  function init() {
    try {
      localStorage.setItem("mochila-peru:test", "1");
      localStorage.removeItem("mochila-peru:test");
    } catch (e) {
      storageOk = false;
    }

    var shared = readSharedPayload();

    $("#controls").addEventListener("submit", function (e) {
      e.preventDefault();
      build(true);
      $("#lista").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#shareBtn").addEventListener("click", function () {
      writeClipboard(shareUrl(), $("#shareBtn"), "Enlace copiado");
    });
    $("#summaryBtn").addEventListener("click", function () {
      writeClipboard(summaryText(), $("#summaryBtn"), "Resumen copiado");
    });
    $("#printBtn").addEventListener("click", function () { downloadPdf($("#printBtn")); });
    $("#resetBtn").addEventListener("click", function () {
      checkedState = {};
      saveChecks();
      $$("#checklist input[type=checkbox]").forEach(function (b) { b.checked = false; });
      $$(".item").forEach(function (li) { li.classList.remove("is-done"); });
      updateMeter();
    });
    $$("input[name=viewMode]").forEach(function (r) {
      r.addEventListener("change", refreshListOnly);
    });
    $("#priorityFilter").addEventListener("change", refreshListOnly);
    $("#sortMode").addEventListener("change", refreshListOnly);
    $$("input[name=zone]").forEach(function (r) {
      r.addEventListener("change", function () {
        applyZonePreset(r.value);
        updateZoneHint();
        saveConfig();
        build(false);
      });
    });
    $$("#controls input").forEach(function (i) {
      if (i.name !== "zone") i.addEventListener("change", function () {
        saveConfig();
        build(false);
      });
    });

    applyConfig(shared ? shared.cfg : loadConfig());
    applyListOptions(shared ? shared.opts : loadListOptions());
    updateZoneHint();
    saveConfig();
    saveListOptions();
    build(false);
    applySharedState(shared);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
