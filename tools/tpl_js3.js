
  /* ---------- panneau de détail ---------- */
  var openCert = null, tableSort = { k: "npec", dir: -1 }, tableFilter = "";

  function idccChips(cols, hi) {
    var ids = [];
    cols.forEach(function (c) { BRANCHES[c].idcc.forEach(function (i) { if (ids.indexOf(i) < 0) ids.push(i); }); });
    ids.sort(function (a, b) { return a - b; });
    var shown = ids.slice(0, 12);
    return '<div class="idccs">' + shown.map(function (i) {
      return '<span class="idcc-chip' + (hi && hi.indexOf(i) >= 0 ? " hit" : "") + '">IDCC ' + i + "</span>";
    }).join("") + (ids.length > shown.length ? '<span class="idcc-chip">+' + (ids.length - shown.length) + "</span>" : "") + "</div>";
  }

  function tierHTML(ci, g, kind) {
    var hiIdcc = state.branch ? state.branch.idcc : null;
    var rows = g.map(function (grp, k) {
      var names = grp.cols.map(function (c) { return BRANCHES[c].name; });
      var first = names.slice(0, 2).map(esc).join(" · ");
      var extra = names.length > 2 ? '<div class="plus">+ ' + (names.length - 2) + " autre" + (names.length > 3 ? "s" : "") + " branche" + (names.length > 3 ? "s" : "") + " au même montant</div>" : "";
      return '<div class="trow"><div class="rank">' + (k + 1) + "</div>" +
        '<div class="amt">' + money(grp.v) + "</div>" +
        '<div class="who"><div class="cpne-n">' + first + "</div>" +
        idccChips(grp.cols, hiIdcc) + extra + "</div></div>";
    }).join("");
    var nb = g.reduce(function (a, x) { return a + x.cols.length; }, 0);
    return '<div class="tier ' + kind + '"><div class="tier-head"><span class="dot"></span>' +
      '<span class="t">' + (kind === "high" ? "5 montants les plus élevés" : "5 montants les plus bas") + "</span>" +
      '<span class="n">' + nb + " branches concernées</span></div>" + rows + "</div>";
  }

  function tableHTML(ci) {
    var f = norm(tableFilter), fnum = tableFilter.trim();
    var rows = BRANCHES.filter(function (b) {
      if (!tableFilter.trim()) return true;
      if (/^\d+$/.test(fnum)) {
        if (String(b.code) === fnum) return true;
        if (b.idcc.some(function (i) { return String(i).indexOf(fnum) === 0; })) return true;
        return b.hay.indexOf(f) >= 0;
      }
      return b.hay.indexOf(f) >= 0;
    }).map(function (b) {
      return { b: b, v: npec(ci, b.col), d: isDecret(ci, b.col) };
    });
    var k = tableSort.k, dir = tableSort.dir;
    rows.sort(function (x, y) {
      var a, b2;
      if (k === "npec") {
        a = x.v; b2 = y.v;
        if (a === null && b2 === null) return 0;
        if (a === null) return 1;
        if (b2 === null) return -1;
        return dir * (a - b2);
      }
      if (k === "code") return dir * (x.b.code - y.b.code);
      if (k === "statut") return dir * ((x.d ? 1 : 0) - (y.d ? 1 : 0));
      return dir * x.b.name.localeCompare(y.b.name, "fr");
    });
    var hiCol = state.branch ? state.branch.col : -1;
    var body = rows.map(function (r) {
      return '<tr' + (r.b.col === hiCol ? ' class="hit"' : "") + "><td class=\"num\">" + r.b.code + "</td>" +
        "<td>" + esc(r.b.name) + "</td>" +
        '<td class="idcc-cell">' + r.b.idcc.join(", ") + "</td>" +
        '<td class="money">' + money(r.v) + "</td>" +
        '<td><span class="badge ' + (r.d ? "decret" : "cpne") + '">' + (r.d ? "Décret" : "CPNE") + "</span></td></tr>";
    }).join("");
    function th(key, label) {
      return '<th data-k="' + key + '">' + label + (tableSort.k === key ? ' <span class="ar">' + (dir > 0 ? "▲" : "▼") + "</span>" : "") + "</th>";
    }
    return '<div class="tablewrap"><div class="tabletools">' +
      '<input id="tfilter" type="search" placeholder="Filtrer : n° IDCC, code CPNE ou nom de branche…" value="' + esc(tableFilter) + '" />' +
      '<button class="chip" id="tcsv" type="button">↓ CSV de cette certification</button>' +
      '<span class="chip-group-label">' + rows.length + " / " + BRANCHES.length + " branches</span></div>" +
      '<div class="tscroll"><table><thead><tr>' +
      th("code", "Code CPNE") + th("name", "Branche (CPNE)") + "<th>IDCC rattachés</th>" + th("npec", "NPEC") + th("statut", "Statut") +
      "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
  }

  function detailHTML(ci) {
    var c = CERTS[ci], s = stats(ci), g = groups(ci);
    var high = g.slice(0, 5);
    var low = g.slice(Math.max(0, g.length - 5)).slice().reverse();
    if (g.length <= 5) low = g.slice().reverse();

    var hero = "";
    if (state.branch) {
      var v = npec(ci, state.branch.col), d = isDecret(ci, state.branch.col);
      hero = '<div class="hero"><div><div class="amount-lab">NPEC applicable</div>' +
        '<div class="big">' + money(v) + "</div></div>" +
        '<div class="who">Pour un contrat signé par une entreprise relevant de<br><b>' + esc(state.branch.name) + "</b>" +
        '<div class="idcc-cell" style="margin-top:6px">IDCC : ' + state.branch.idcc.join(", ") + " · Code CPNE " + state.branch.code + "</div></div>" +
        '<span class="badge ' + (d ? "decret" : "cpne") + '" style="margin-left:auto">' + (d ? "Valeur fixée par décret" : "Valeur décidée par la CPNE") + "</span></div>" +
        (v === null || v === undefined ? '<p class="note">⚠︎ Le référentiel source ne comporte pas de montant exploitable pour ce couple certification × branche (cellule « NPEC final » non numérique). Rapprochez-vous de votre OPCO.</p>' : "");
    } else {
      hero = '<div class="hero"><div><div class="amount-lab">Fourchette des NPEC</div>' +
        '<div class="big">' + money(s.min) + " – " + money(s.max) + "</div></div>" +
        '<div class="who">Le montant exact dépend de la branche de l\'employeur.<br>Renseignez un <b>n° IDCC</b> ou un nom de branche pour obtenir le NPEC applicable.</div></div>';
    }

    return hero +
      '<div class="stats">' +
      '<div class="stat"><div class="k">Minimum</div><div class="v">' + money(s.min) + "</div></div>" +
      '<div class="stat"><div class="k">Médiane</div><div class="v">' + money(s.med) + "</div></div>" +
      '<div class="stat"><div class="k">Moyenne</div><div class="v">' + money(s.moy) + "</div></div>" +
      '<div class="stat"><div class="k">Maximum</div><div class="v">' + money(s.max) + "</div></div>" +
      '<div class="stat"><div class="k">Écart max/min</div><div class="v">' + (s.min ? "×" + (s.max / s.min).toFixed(2).replace(".", ",") : "—") + "</div></div>" +
      '<div class="stat"><div class="k">Montants distincts</div><div class="v">' + s.distinct + "</div></div>" +
      "</div>" +
      "<div>" + '<h3 class="sec">Information — dispersion du NPEC par branche<span class="tag">' + s.nb + " branches valorisées" + (s.miss ? " · " + s.miss + " non exploitable" : "") + "</span></h3>" +
      '<div class="two">' + tierHTML(ci, high, "high") + tierHTML(ci, low, "low") + "</div></div>" +
      "<div>" + '<h3 class="sec">Grille complète — toutes les branches</h3>' + tableHTML(ci) + "</div>" +
      '<p class="note">Date d\'applicabilité : ' + esc(fmtDate(D.meta.dateApplicabilite)) + '. Source : ' + esc(D.meta.source) + ".</p>";
  }

  function openDetail(ci) {
    openCert = ci; tableFilter = ""; tableSort = { k: "npec", dir: -1 };
    var c = CERTS[ci];
    el("p-title").textContent = c.lib;
    el("p-sub").innerHTML = '<span class="badge">' + esc(c.type) + "</span>" +
      '<span class="rncp" style="margin:0">' + esc(c.codes.join(" · ")) + "</span>" +
      '<span class="certif" style="margin:0;border:none;padding:0">' + esc(c.cert || "") + "</span>";
    refreshDetail();
    el("overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function refreshDetail() { el("p-body").innerHTML = detailHTML(openCert); }
  function closeDetail() {
    el("overlay").hidden = true; openCert = null; document.body.style.overflow = "";
  }
