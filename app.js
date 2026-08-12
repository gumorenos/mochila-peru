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
      var real = items.filter(Boolean);
      if (real.length) cats.push({ id: id, title: LABELS.cats[id], items: real });
    }
    function item(name, qty, why, priority) {
      return { name: name, qty: qty, why: why, priority: priority || "" };
    }

    cat("agua", [
      people > 0 && item("Agua para beber e higiene básica", waterL + " L", "Referencia práctica: 4 L por persona por día para beber, cocinar simple y lavarse lo mínimo.", "crítico"),
      item("Bidones o galoneras cerradas", Math.max(2, Math.ceil(waterL / 20)) + " de 20 L", "El agua sirve de poco si no está almacenada en envases limpios, cerrados y fáciles de mover.", "primero"),
      item("Pastillas potabilizadoras o lejía sin perfume", cfg.hazards.lluvias || cfg.hazards.huaico ? "1 caja + gotero" : "1 caja", "Tras lluvias, huaicos o cortes, el agua puede contaminarse aunque se vea clara.", "primero"),
      item("Botellas chicas para evacuar", Math.max(people, 1) + " unidades", "Sirven para salir rápido sin cargar todo el bidón.")
    ]);

    cat("alimentos", [
      people > 0 && item("Alimentos listos para comer", personDays + " persona-días", "Conservas, galletas, frutos secos, avena instantánea o comida que no dependa de refrigeración.", "primero"),
      item("Abrelatas manual", "1", "Parece obvio hasta que todas las latas esperan y no hay luz. Clásico peruano.", "primero"),
      item("Cubiertos, platos y vasos reutilizables", Math.max(people, 1) + " juegos", "Reduce residuos y evita comer directo de envases sucios."),
      item("Sal, azúcar y sobres de bebida", "1 bolsa pequeña", "Ayudan a mantener energía y hacer tolerable la comida de emergencia.")
    ]);

    cat("salud", [
      item("Botiquín familiar completo", "1", "Gasas, vendas, curitas, antiséptico, guantes, tijera, esparadrapo y suero fisiológico.", "crítico"),
      item("Paracetamol o ibuprofeno", "1 caja", "Dolor y fiebre son comunes cuando no hay atención inmediata.", "primero"),
      item("Sales de rehidratación oral", Math.max(people * 2, 2) + " sobres", "La deshidratación por diarrea, calor o mala agua puede complicarse rápido.", "primero"),
      item("Alcohol, jabón o gel desinfectante", "1 set", "Previene infecciones cuando el agua limpia escasea."),
      cfg.meds && item("Medicamentos diarios", "7 días o más", "Guarda dosis extra, receta o foto de receta, y nombre genérico del medicamento.", "crítico"),
      item("Teléfonos de emergencia impresos", "1 tarjeta", "Bomberos 116, Policía 105, SAMU 106, emergencias 911 donde aplique, familia y vecinos.", "primero")
    ]);

    cat("comunicacion", [
      item("Radio a pilas o manivela", "1", "Cuando internet cae, las indicaciones oficiales llegan por radio.", "crítico"),
      item("Silbato", Math.max(people, 1), "Tres pitidos ayudan a ubicarte si quedas atrapado o separado.", "crítico"),
      item("Lista impresa de contactos y punto de reunión", "1 por familia", "Define antes donde se encuentran si los teléfonos no funcionan.", "primero"),
      item("Mapa simple de rutas seguras", "1", "Marca salida del edificio, zona alta si hay tsunami y centro de reunión vecinal.")
    ]);

    cat("luz", [
      item("Linterna o frontal", Math.max(cfg.adults + cfg.elderly, 1), "Luz de manos libres para escaleras, vidrios rotos o evacuación nocturna.", "crítico"),
      item("Pilas de repuesto", "2 juegos", "Las pilas mueren en el peor momento, con una puntualidad casi artística.", "primero"),
      item("Power bank cargado", people <= 2 ? "1 de 10,000 mAh" : "2 de 10,000 mAh", "Mantiene vivo al menos un celular para llamadas y alertas.", "primero"),
      cfg.hazards.corte && item("Cargador solar o de auto", "1", "Útil si el corte dura varios días o estás aislado.")
    ]);

    cat("seguridad", [
      item("Guantes de trabajo", Math.max(cfg.adults, 1) + " pares", "Para mover vidrio, metal, madera y escombros sin cortarte.", "primero"),
      item("Navaja multiuso", "1", "Sirve para abrir, cortar, ajustar y reparar cosas pequeñas."),
      item("Cinta americana y cuerda", "1 rollo + 10 m", "Improvisa cierres, amarras, reparaciones y señalización."),
      cfg.hazards.sismo && item("Zapatillas cerradas junto a la cama", Math.max(people, 1) + " pares", "Después de un sismo el piso puede quedar con vidrios y objetos filudos.", "primero"),
      cfg.hazards.incendio && item("Extintor ABC revisado", "1", "Un fuego pequeño se puede controlar antes de que cierre la salida.", "crítico"),
      cfg.apartment && item("Llaves y plan de evacuación del edificio", "1 set", "Identifica escaleras, punto de reunión y quien ayuda a vecinos vulnerables.")
    ]);

    cat("higiene", [
      item("Papel higiénico, pañitos y bolsas gruesas", days + " días", "Sanidad básica si el agua o desagüe falla."),
      item("Mascarillas", Math.max(people * 3, 3), "Polvo, humo, escombros, ceniza o refugios concurridos."),
      item("Toallas higiénicas o productos menstruales", "según hogar", "Es de lo primero que falta y de lo último que se recuerda."),
      item("Repelente y bloqueador", cfg.zone === "selva" || cfg.zone === "costa-norte" ? "1 por adulto" : "1", "Zancudos, sol y esperas largas no piden permiso."),
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
      cfg.infants > 0 && item("Pañales", cfg.infants * days * 6 + " unidades", "Cálculo simple: 6 pañales por bebé por día.", "primero"),
      cfg.infants > 0 && item("Fórmula o alimento de bebé", days + " días", "Usa lo que el bebé ya tolera; no experimentes en emergencia.", "crítico"),
      cfg.infants > 0 && item("Pañitos, crema y bolsas", "1 set", "Higiene rápida sin agua corriente."),
      cfg.children > 0 && item("Snacks y objeto de calma", cfg.children + " " + plural(cfg.children, "set"), "Ayuda a que los niños cooperen durante esperas largas.")
    ]);

    cat("mayores", [
      cfg.elderly > 0 && item("Lentes, audífonos o baterías extra", "1 set", "Perder autonomía en evacuación aumenta el riesgo.", "primero"),
      cfg.mobility && item("Bastón, andador o repuestos", "1 set", "La evacuación debe funcionar con cortes de luz y escaleras.", "crítico"),
      (cfg.elderly > 0 || cfg.meds) && item("Ficha médica impresa", "1 por persona", "Alergias, diagnósticos, medicinas, dosis y contactos.")
    ]);

    cat("mascotas", [
      cfg.pets > 0 && item("Comida para mascota", cfg.pets * days + " mascota-días", "Usa su alimento habitual para evitar problemas digestivos.", "primero"),
      cfg.pets > 0 && item("Agua extra para mascota", cfg.pets * days + " L", "No debe beber agua de acequias, charcos o inundación.", "primero"),
      cfg.pets > 0 && item("Correa, placa y transportador", cfg.pets + " sets", "Facilita evacuar y entrar a albergues o casas de familiares."),
      cfg.pets > 0 && item("Vacunas o datos veterinarios", "1 copia", "Puede ser necesario para recibirlos en refugios o traslados.")
    ]);

    cat("zona", [
      cfg.hazards.tsunami && item("Ruta a zona alta", "1 mapa marcado", "Si estás en costa, evacúa a pie hacia zona alta después de sismo fuerte o alerta.", "crítico"),
      cfg.hazards.huaico && item("Ruta alterna fuera de quebradas", "1 plan", "No cruces cauces activos; identifica salida por zonas altas o seguras.", "crítico"),
      cfg.hazards.lluvias && item("Botas o calzado impermeable", Math.max(cfg.adults, 1) + " pares", "Agua estancada trae cortes, infecciones y cables caídos.", "primero"),
      cfg.hazards.ceniza && item("Respiradores N95 y lentes cerrados", Math.max(people * 4, 4) + " mascarillas", "La ceniza volcánica irrita pulmones y ojos; no basta una tela.", "crítico"),
      cfg.hazards.friaje && item("Termo y bebidas calientes", "1 set", "En friaje o helada, conservar temperatura corporal es prioridad."),
      cfg.zone === "selva" && item("Mosquitero liviano", "1", "Reduce picaduras si debes dormir fuera o con ventanas abiertas.")
    ]);

    return { cats: cats, meta: { people: people, waterL: waterL, personDays: personDays } };
  }

  function renderSummary(cfg, meta) {
    var hazards = Object.keys(cfg.hazards).filter(function (k) { return cfg.hazards[k]; })
      .map(function (k) { return LABELS.hazards[k]; });
    $("#summary").innerHTML =
      '<div class="summary__card">' +
      '<p><strong>' + (meta.people || 0) + ' personas</strong> - ' + cfg.days + ' días - ' + LABELS.zones[cfg.zone] + '</p>' +
      '<p>Agua objetivo: <strong>' + meta.waterL + ' L</strong> - comida: <strong>' + meta.personDays + ' persona-días</strong></p>' +
      '<p>Riesgos: ' + (hazards.join(", ") || "ninguno seleccionado") + '</p>' +
      '</div>';
  }

  function renderChecklist(plan) {
    var root = $("#checklist");
    root.innerHTML = "";
    plan.cats.forEach(function (c) {
      var section = el("section", "cat");
      var head = el("div", "cat__head");
      head.appendChild(el("span", "cat__glyph", ICONS[c.id] || "PE"));
      head.appendChild(el("h3", null, c.title));
      head.appendChild(el("span", "cat__count"));
      section.appendChild(head);

      var list = el("ul", "cat__list");
      c.items.forEach(function (it, idx) {
        var id = c.id + "-" + idx + "-" + slug(it.name);
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
        li.appendChild(label);
        li.appendChild(el("p", "item__why", it.why));

        var expiry = el("div", "item__expiry");
        var expiryLabel = el("label", null, "Vence / revisar");
        var expiryInput = el("input");
        expiryInput.type = "date";
        expiryInput.id = "exp-" + id;
        expiryInput.name = "expiry-" + id;
        expiryInput.value = expiryState[id] || "";
        expiryInput.setAttribute("aria-label", "Fecha de vencimiento o revisión para " + it.name);
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
        list.appendChild(li);
      });
      section.appendChild(list);
      root.appendChild(section);
    });
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
    var dates = Object.keys(expiryState).map(function (id) { return expiryState[id]; }).filter(Boolean);
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
      target.textContent = "Sin fechas de vencimiento registradas.";
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
    if (cfg.zone === "costa-norte") {
      $("input[value=lluvias]").checked = true;
      $("input[value=huaico]").checked = true;
    }
    if (cfg.zone === "sierra") {
      $("input[value=friaje]").checked = true;
      $("input[value=huaico]").checked = true;
    }
    if (cfg.zone === "selva") {
      $("input[value=lluvias]").checked = true;
    }
    if (cfg.zone === "sur-volcanico") {
      $("input[value=ceniza]").checked = true;
      $("input[value=friaje]").checked = true;
    }
  }

  function build(preserveChecks) {
    var cfg = readConfig();
    var key = configKey(cfg);
    if (!preserveChecks || key !== currentKey) {
      currentKey = key;
      loadChecks(key);
    }
    var plan = buildPlan(cfg);
    renderSummary(cfg, plan.meta);
    renderChecklist(plan);
  }

  function init() {
    try {
      localStorage.setItem("mochila-peru:test", "1");
      localStorage.removeItem("mochila-peru:test");
    } catch (e) {
      storageOk = false;
    }

    $("#controls").addEventListener("submit", function (e) {
      e.preventDefault();
      build(true);
      $("#lista").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#printBtn").addEventListener("click", function () { window.print(); });
    $("#resetBtn").addEventListener("click", function () {
      checkedState = {};
      saveChecks();
      $$("#checklist input[type=checkbox]").forEach(function (b) { b.checked = false; });
      $$(".item").forEach(function (li) { li.classList.remove("is-done"); });
      updateMeter();
    });
    $$("input[name=zone]").forEach(function (r) {
      r.addEventListener("change", function () {
        updateZoneHint();
        build(false);
      });
    });
    $$("input").forEach(function (i) {
      if (i.name !== "zone") i.addEventListener("change", function () { build(false); });
    });

    updateZoneHint();
    build(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
