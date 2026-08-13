(function () {
  "use strict";

  var STORAGE_KEY = "mochila-peru:print-snapshot";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function readSnapshot() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function metaCell(label, value) {
    var cell = el("div", "meta__cell");
    cell.appendChild(el("span", "meta__label", label));
    cell.appendChild(el("span", "meta__value", value));
    return cell;
  }

  function pill(text, cls) {
    if (!text) return null;
    return el("span", "pill" + (cls ? " " + cls : ""), text);
  }

  function renderItem(item) {
    var li = el("li", "item");
    var ready = el("span", "ready" + (item.ready === "Listo" ? " ready--done" : ""), item.ready || "Pendiente");
    var main = el("div", "item__main");
    var line = el("div", "item__line");

    line.appendChild(el("span", "item__name", item.name || "Artículo"));
    [pill(item.qty), pill(item.priority, "pill--priority"), pill(item.date)].forEach(function (node) {
      if (node) line.appendChild(node);
    });

    main.appendChild(line);
    if (item.why) main.appendChild(el("p", "item__why", item.why));
    li.appendChild(ready);
    li.appendChild(main);
    return li;
  }

  function renderCategory(category) {
    var section = el("section", "category");
    var list = el("ul", "items");
    section.appendChild(el("h2", "category__title", category.title || "Categoría"));
    (category.items || []).forEach(function (item) {
      list.appendChild(renderItem(item));
    });
    section.appendChild(list);
    return section;
  }

  function render(data) {
    var root = document.getElementById("sheet");
    root.innerHTML = "";
    if (!data || !data.categories) {
      root.appendChild(el("p", "empty", "No se pudo preparar la lista. Vuelve a la app y toca Descargar PDF otra vez."));
      return;
    }

    root.appendChild(el("h1", "title", data.title || "Mochila Perú"));

    var meta = el("section", "meta");
    meta.appendChild(metaCell("Zona", data.zone || "-"));
    meta.appendChild(metaCell("Hogar", (data.people || 0) + " personas"));
    meta.appendChild(metaCell("Autonomía", (data.days || 0) + " días"));
    meta.appendChild(metaCell("Avance", (data.done || 0) + " de " + (data.total || 0)));
    meta.appendChild(metaCell("Agua", (data.waterL || 0) + " L"));
    root.appendChild(meta);

    root.appendChild(el("p", "hazards", "Riesgos: " + ((data.hazards || []).join(", ") || "ninguno seleccionado")));

    data.categories.forEach(function (category) {
      root.appendChild(renderCategory(category));
    });

    if (data.note) root.appendChild(el("p", "note", data.note));
  }

  function printPage(button) {
    var original = button.textContent;
    button.textContent = "Abriendo...";
    window.print();
    setTimeout(function () {
      button.textContent = original;
    }, 1200);
  }

  function init() {
    var saveButton = document.getElementById("savePdf");
    var printButton = document.getElementById("printPdf");
    var snapshot = readSnapshot();
    render(snapshot);
    saveButton.addEventListener("click", function () {
      var original = saveButton.textContent;
      if (!window.MochilaPdf || !window.MochilaPdf.save) {
        printPage(saveButton);
        return;
      }
      saveButton.textContent = "Generando...";
      window.MochilaPdf.save(snapshot).then(function () {
        saveButton.textContent = "PDF listo";
        setTimeout(function () { saveButton.textContent = original; }, 1400);
      }).catch(function () {
        saveButton.textContent = "Cancelado";
        setTimeout(function () { saveButton.textContent = original; }, 1400);
      });
    });
    printButton.addEventListener("click", function () {
      printPage(printButton);
    });
    document.getElementById("closePdf").addEventListener("click", function () {
      window.close();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
