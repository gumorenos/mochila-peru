(function () {
  "use strict";

  var PAGE_W = 595.28;
  var PAGE_H = 841.89;
  var M = 42;
  var CONTENT_W = PAGE_W - M * 2;

  function latinByte(ch) {
    var code = ch.charCodeAt(0);
    if (code <= 255) return code;
    var map = {
      0x2013: 45, 0x2014: 45, 0x2018: 39, 0x2019: 39, 0x201c: 34,
      0x201d: 34, 0x2022: 45, 0x2026: 46, 0x00a0: 32
    };
    return map[code] || 63;
  }

  function asciiBytes(text) {
    var out = [];
    for (var i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 255);
    return out;
  }

  function pushAscii(out, text) {
    for (var i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 255);
  }

  function pdfText(text) {
    var src = String(text == null ? "" : text).normalize("NFC");
    var out = [40];
    for (var i = 0; i < src.length; i += 1) {
      var b = latinByte(src[i]);
      if (b === 40 || b === 41 || b === 92) out.push(92);
      if (b === 10 || b === 13 || b === 9) b = 32;
      out.push(b);
    }
    out.push(41);
    return out;
  }

  function textWidth(text, size) {
    var src = String(text || "");
    var units = 0;
    for (var i = 0; i < src.length; i += 1) {
      var ch = src[i];
      if (ch === " ") units += 0.28;
      else if ("ilI.,:;!'|".indexOf(ch) >= 0) units += 0.25;
      else if ("mwMW@#%".indexOf(ch) >= 0) units += 0.78;
      else units += 0.5;
    }
    return units * size;
  }

  function wrap(text, size, maxWidth) {
    var words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      if (!word) return;
      var next = line ? line + " " + word : word;
      if (textWidth(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function makePdfBytes(data) {
    var pages = [];
    var page = [];
    var y = PAGE_H - M;

    function newPage() {
      if (page.length) pages.push(page);
      page = [];
      y = PAGE_H - M;
    }

    function ensure(space) {
      if (y - space < M) newPage();
    }

    function text(x, value, size, font, color) {
      var rgb = color || "0.11 0.14 0.15";
      pushAscii(page, "BT /" + (font || "F1") + " " + size + " Tf " + rgb + " rg " + x.toFixed(2) + " " + y.toFixed(2) + " Td ");
      Array.prototype.push.apply(page, pdfText(value));
      pushAscii(page, " Tj ET\n");
    }

    function line(x1, y1, x2, y2, color, width) {
      pushAscii(page, (color || "0.84 0.82 0.77") + " RG " + (width || 0.7) + " w " + x1.toFixed(2) + " " + y1.toFixed(2) + " m " + x2.toFixed(2) + " " + y2.toFixed(2) + " l S\n");
    }

    function paragraph(value, size, maxWidth, x, leading, font, color) {
      wrap(value, size, maxWidth).forEach(function (ln) {
        ensure(leading + 4);
        text(x || M, ln, size, font, color);
        y -= leading;
      });
    }

    function meta(label, value, x, w) {
      text(x, String(label).toUpperCase(), 8, "F2", "0.39 0.44 0.47");
      y -= 11;
      paragraph(value, 11, w, x, 13, "F2");
    }

    data = data || {};
    text(M, data.title || "Mochila Peru", 27, "F2");
    y -= 30;
    line(M, y + 8, PAGE_W - M, y + 8, "0.62 0.59 0.55", 1.2);

    var metaY = y;
    var col = CONTENT_W / 5;
    [
      ["Zona", data.zone || "-"],
      ["Hogar", (data.people || 0) + " personas"],
      ["Autonomía", (data.days || 0) + " días"],
      ["Avance", (data.done || 0) + " de " + (data.total || 0)],
      ["Agua", (data.waterL || 0) + " L"]
    ].forEach(function (m, idx) {
      y = metaY;
      meta(m[0], m[1], M + col * idx, col - 8);
    });
    y = metaY - 38;

    paragraph("Riesgos: " + ((data.hazards || []).join(", ") || "ninguno seleccionado"), 10, CONTENT_W, M, 13, "F1", "0.39 0.44 0.47");
    y -= 10;

    (data.categories || []).forEach(function (category) {
      ensure(46);
      text(M, String(category.title || "Categoría").toUpperCase(), 12, "F2");
      y -= 8;
      line(M, y, PAGE_W - M, y, "0.62 0.59 0.55", 1);
      y -= 15;

      (category.items || []).forEach(function (item) {
        var status = item.ready || "Pendiente";
        var details = [item.qty, item.priority, item.date].filter(Boolean).join(" · ");
        var nameLines = wrap(item.name || "Artículo", 11, CONTENT_W - 95);
        var whyLines = item.why ? wrap(item.why, 9, CONTENT_W - 95) : [];
        var block = Math.max(24, nameLines.length * 13 + whyLines.length * 11 + (details ? 12 : 0) + 4);
        ensure(block + 6);

        text(M, status, 9, item.ready === "Listo" ? "F2" : "F1", item.ready === "Listo" ? "0.13 0.45 0.30" : "0.39 0.44 0.47");
        var itemY = y;
        nameLines.forEach(function (ln) {
          y = itemY;
          text(M + 88, ln, 11, "F2");
          itemY -= 13;
        });
        if (details) {
          y = itemY;
          paragraph(details, 8.5, CONTENT_W - 95, M + 88, 11, "F1", "0.39 0.44 0.47");
          itemY = y;
        }
        whyLines.forEach(function (ln) {
          y = itemY;
          text(M + 88, ln, 9, "F1", "0.39 0.44 0.47");
          itemY -= 11;
        });
        y = itemY - 4;
        line(M, y, PAGE_W - M, y);
        y -= 10;
      });
      y -= 5;
    });

    if (data.note) {
      y -= 8;
      paragraph(data.note, 8.5, CONTENT_W, M, 11, "F1", "0.39 0.44 0.47");
    }
    if (page.length) pages.push(page);

    var objects = [];
    function addObject(bytes) {
      objects.push(bytes);
      return objects.length;
    }

    addObject([]); // catalog
    addObject([]); // pages tree
    addObject(asciiBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
    addObject(asciiBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

    var pageIds = [];
    pages.forEach(function (content) {
      var stream = [];
      pushAscii(stream, "<< /Length " + content.length + " >>\nstream\n");
      Array.prototype.push.apply(stream, content);
      pushAscii(stream, "endstream");
      var contentId = addObject(stream);
      var pageId = addObject(asciiBytes("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_W.toFixed(2) + " " + PAGE_H.toFixed(2) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentId + " 0 R >>"));
      pageIds.push(pageId);
    });

    objects[0] = asciiBytes("<< /Type /Catalog /Pages 2 0 R >>");
    objects[1] = asciiBytes("<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>");

    var out = [];
    var offsets = [0];
    pushAscii(out, "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    objects.forEach(function (obj, i) {
      offsets.push(out.length);
      pushAscii(out, (i + 1) + " 0 obj\n");
      Array.prototype.push.apply(out, obj);
      pushAscii(out, "\nendobj\n");
    });
    var xref = out.length;
    pushAscii(out, "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n");
    for (var j = 1; j < offsets.length; j += 1) {
      pushAscii(out, String(offsets[j]).padStart(10, "0") + " 00000 n \n");
    }
    pushAscii(out, "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
    return new Uint8Array(out);
  }

  function filename(data) {
    var date = new Date().toISOString().slice(0, 10);
    return "mochila-peru-" + date + ".pdf";
  }

  function isAppleMobile() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  async function save(data) {
    var blob = new Blob([makePdfBytes(data)], { type: "application/pdf" });
    var name = filename(data);
    if (isAppleMobile() && window.File && navigator.canShare && navigator.share) {
      var file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mochila Perú", text: "Lista de mochila de emergencia" });
        return { mode: "share", name: name };
      }
    }

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return { mode: "download", name: name };
  }

  window.MochilaPdf = {
    blob: function (data) { return new Blob([makePdfBytes(data)], { type: "application/pdf" }); },
    save: save
  };
})();
