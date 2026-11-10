
  /* ---------- index de recherche ---------- */
  function buildIndex() {
    CERTS = D.certs.map(function (c, i) {
      var certif = D.certifiers[c[2]], type = D.types[c[3]];
      var codes = c[0].split("/");
      return {
        i: i, rncp: c[0], codes: codes, lib: c[1], cert: certif, type: type,
        hay: norm(c[1] + " " + c[0] + " " + certif + " " + type + " " + codes.join(" ").replace(/RNCP/gi, ""))
      };
    });
    BRANCHES = D.cpne.map(function (b, col) {
      return { col: col, code: b[0], name: b[1], idcc: b[2], hay: norm(b[1]) };
    });
    D.cpne.forEach(function (b, col) {
      b[2].forEach(function (id) {
        (IDCC2COLS[id] = IDCC2COLS[id] || []).push(col);
      });
    });
  }

  /* Recherche de branches : n° IDCC (exact puis préfixe), code CPNE, ou nom. */
  function findBranches(q) {
    var t = q.trim();
    if (!t) return [];
    var out = [], seen = {};
    function push(col, why) { if (!seen[col]) { seen[col] = 1; out.push({ b: BRANCHES[col], why: why }); } }

    if (/^\d+$/.test(t)) {
      var n = parseInt(t, 10);
      (IDCC2COLS[n] || []).forEach(function (c) { push(c, "IDCC " + n); });
      BRANCHES.forEach(function (b) { if (b.code === n) push(b.col, "code CPNE " + n); });
      if (t.length >= 2) {
        Object.keys(IDCC2COLS).forEach(function (k) {
          if (k !== String(n) && k.indexOf(t) === 0) {
            IDCC2COLS[k].forEach(function (c) { push(c, "IDCC " + k); });
          }
        });
      }
    }
    var toks = norm(t).split(" ").filter(Boolean);
    if (toks.length) {
      BRANCHES.forEach(function (b) {
        var ok = toks.every(function (tk) { return b.hay.indexOf(tk) >= 0; });
        if (ok) push(b.col, null);
      });
    }
    return out.slice(0, 40);
  }

  /* Recherche de formations : tous les mots doivent être présents. */
  function findCerts(q) {
    var t = q.trim();
    if (!t) return CERTS.slice();
    var raw = t.toLowerCase().replace(/rncp/g, " ");
    var toks = norm(raw).split(" ").filter(Boolean);
    if (!toks.length) return CERTS.slice();
    var res = [];
    for (var i = 0; i < CERTS.length; i++) {
      var c = CERTS[i], score = 0, ok = true;
      for (var k = 0; k < toks.length; k++) {
        var p = c.hay.indexOf(toks[k]);
        if (p < 0) { ok = false; break; }
        score += p === 0 ? 3 : (c.hay.charAt(p - 1) === " " ? 2 : 1);
      }
      if (!ok) continue;
      var nlib = norm(c.lib);
      if (nlib.indexOf(toks.join(" ")) === 0) score += 40;
      else if (nlib.indexOf(toks.join(" ")) > 0) score += 12;
      score -= Math.min(10, c.lib.length / 40);
      res.push({ c: c, s: score });
    }
    res.sort(function (a, b) { return b.s - a.s; });
    return res.map(function (r) { return r.c; });
  }

  function highlight(text, q) {
    var toks = q.trim().toLowerCase().replace(/rncp/g, " ").split(/[^0-9a-zà-ÿ]+/i).filter(function (t) { return t.length > 1; });
    var out = esc(text);
    if (!toks.length) return out;
    try {
      var re = new RegExp("(" + toks.map(function (t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("|") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    } catch (e) { /* requête non regexable : on laisse tel quel */ }
    return out;
  }

  /* ---------- rendu ---------- */
  function computeList() {
    var list = findCerts(state.qf);
    if (state.type) list = list.filter(function (c) { return c.type === state.type; });
    var col = state.branch ? state.branch.col : null;
    if (state.sort === "alpha") {
      list = list.slice().sort(function (a, b) { return a.lib.localeCompare(b.lib, "fr"); });
    } else if (state.sort === "desc" || state.sort === "asc") {
      var dir = state.sort === "desc" ? -1 : 1;
      var key = col === null
        ? function (c) { return stats(c.i).med; }
        : function (c) { var v = npec(c.i, col); return v === undefined ? null : v; };
      // les montants indisponibles restent en fin de liste, quel que soit le sens du tri
      list = list.slice().sort(function (a, b) {
        var x = key(a), y = key(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return dir * (x - y);
      });
    }
    state.list = list;
  }

  function cardHTML(c) {
    var col = state.branch ? state.branch.col : null;
    var body = "";
    if (col !== null) {
      var v = npec(c.i, col), d = isDecret(c.i, col);
      body = '<div><div class="amount-lab">NPEC · ' + esc(state.branch.name.slice(0, 46)) + (state.branch.name.length > 46 ? "…" : "") + '</div>' +
        '<div class="amount' + (v === null ? " na" : "") + '">' + money(v) + '</div></div>' +
        '<span class="badge ' + (d ? "decret" : "cpne") + '">' + (d ? "Décret" : "CPNE") + "</span>";
    } else {
      var s = stats(c.i);
      body = '<div class="range">' +
        '<div><div class="amount-lab">Minimum</div><div class="v">' + money(s.min) + "</div></div>" +
        '<div><div class="amount-lab">Médiane</div><div class="v">' + money(s.med) + "</div></div>" +
        '<div><div class="amount-lab">Maximum</div><div class="v">' + money(s.max) + "</div></div>" +
        "</div>";
    }
    /* Opportunités / vigilance par rapport à la référence :
       le NPEC de la branche sélectionnée, sinon la médiane. */
    var s2 = stats(c.i);
    var refv = col !== null ? npec(c.i, col) : s2.med;
    if (refv === null || refv === undefined) refv = s2.med;
    var bA = 0, bB = 0;
    groups(c.i).forEach(function (x) {
      if (x.v > refv) bA += x.cols.length;
      else if (x.v < refv) bB += x.cols.length;
    });
    var mini = '<div class="mini">' +
      (bA ? '<span class="opp">▲ Opportunités · ' + bA + " branche" + (bA > 1 ? "s" : "") + " jusqu'à " + money(s2.max) + "</span>"
          : '<span class="opp">✔ Au maximum des branches</span>') +
      (bB ? '<span class="vig">▼ Vigilance · ' + bB + " branche" + (bB > 1 ? "s" : "") + " dès " + money(s2.min) + "</span>"
          : '<span class="vig">✔ Au minimum des branches</span>') +
      "</div>";
    if (!bA && !bB) mini = '<div class="mini"><span class="opp">Montant identique dans toutes les branches</span></div>';
    return '<button class="card" data-i="' + c.i + '" type="button">' +
      '<div class="card-head"><div class="name">' + highlight(c.lib, state.qf) + "</div>" +
      '<span class="badge">' + esc(c.type) + "</span></div>" +
      '<div class="rncp">' + highlight(c.codes.join(" · "), state.qf) + "</div>" +
      '<div class="certif">' + esc(c.cert || "Certificateur non précisé") + "</div>" +
      '<div class="amount-row">' + body + "</div>" + mini + "</button>";
  }

  function render() {
    computeList();
    var n = state.list.length;
    var col = state.branch ? state.branch.col : null;
    el("countline").innerHTML = "<strong>" + nf.format(n) + "</strong> certification" + (n > 1 ? "s" : "") +
      (state.qf ? " <em>pour « " + esc(state.qf) + " »</em>" : "") +
      (col !== null ? " <em>· NPEC de la branche sélectionnée</em>" : "");
    el("reset").hidden = !(state.qf || state.branch || state.type);
    var slice = state.list.slice(0, state.shown);
    el("results").innerHTML = slice.map(cardHTML).join("") ||
      '<div class="empty-state" style="grid-column:1/-1"><h2>Aucune certification trouvée</h2>' +
      "<p>Essayez un mot-clé plus court, un code RNCP, ou vérifiez le type de diplôme sélectionné.</p></div>";
    el("more").hidden = state.shown >= n;
    el("more").textContent = "Afficher plus de résultats (" + nf.format(Math.min(PAGE, n - state.shown)) + " sur " + nf.format(n - state.shown) + " restants)";
  }
