
  /* ---------- export CSV ---------- */
  var toastT;
  function toast(msg) {
    var t = el("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast"; t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 4200);
  }

  /* Le visualiseur d'artefact n'autorise pas les liens de téléchargement :
     on passe par la capacité "downloads" quand elle est disponible, et on
     retombe sur le lien blob partout ailleurs (page servie ou fichier local). */
  var capDl;
  function downloadsCap() {
    if (capDl !== undefined) return Promise.resolve(capDl);
    if (!window.claude || typeof window.claude.use !== "function") { capDl = null; return Promise.resolve(null); }
    return window.claude.use("downloads").then(function (d) { capDl = d || null; return capDl; },
      function () { capDl = null; return null; });
  }

  function dl(name, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        v = v === null || v === undefined ? "" : String(v);
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(";");
    }).join("\r\n");
    var text = "﻿" + csv;
    downloadsCap().then(function (caps) {
      if (caps) {
        return caps.save({ filename: name, data: text }).then(function () {
          toast(name + " enregistré.");
        }, function (e) {
          if (e && e.code === "declined") return;
          toast("Export impossible : " + ((e && e.message) || "erreur inconnue") + ".");
        });
      }
      var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  }

  function csvCert(ci) {
    var c = CERTS[ci];
    var rows = [["RNCP", "Libellé de la formation", "Type", "Certificateur", "Code CPNE", "CPNE", "IDCC rattachés", "NPEC", "Statut", "Date d'applicabilité"]];
    BRANCHES.forEach(function (b) {
      rows.push([c.rncp, c.lib, c.type, c.cert, b.code, b.name, b.idcc.join(" "), npec(ci, b.col), isDecret(ci, b.col) ? "D" : "CPNE", D.meta.dateApplicabilite]);
    });
    dl("npec-" + c.codes[0] + ".csv", rows);
  }

  function csvResults() {
    var col = state.branch ? state.branch.col : null;
    var head = ["RNCP", "Libellé de la formation", "Type", "Certificateur"];
    if (col !== null) head = head.concat(["Code CPNE", "CPNE", "IDCC rattachés", "NPEC", "Statut"]);
    else head = head.concat(["NPEC min", "NPEC médian", "NPEC max"]);
    var rows = [head];
    state.list.forEach(function (c) {
      var base = [c.rncp, c.lib, c.type, c.cert];
      if (col !== null) {
        var b = state.branch;
        rows.push(base.concat([b.code, b.name, b.idcc.join(" "), npec(c.i, col), isDecret(c.i, col) ? "D" : "CPNE"]));
      } else {
        var s = stats(c.i);
        rows.push(base.concat([s.min, s.med, s.max]));
      }
    });
    dl("npec-resultats.csv", rows);
  }

  /* ---------- branche : suggestions ---------- */
  var sugItems = [], sugHl = -1;

  function renderSuggest(q) {
    var box = el("suggest");
    if (!q.trim()) { box.hidden = true; sugItems = []; return; }
    var res = findBranches(q);
    sugItems = res; sugHl = -1;
    if (!res.length) {
      box.innerHTML = '<div class="empty">Aucune branche trouvée pour « ' + esc(q) + ' ». Essayez un n° IDCC (ex. 1486) ou un mot du nom de la branche (ex. métallurgie).</div>';
      box.hidden = false; return;
    }
    box.innerHTML = res.map(function (r, k) {
      var ids = r.b.idcc.slice();
      var m = r.why && /^IDCC (\d+)$/.test(r.why) ? parseInt(r.why.slice(5), 10) : null;
      if (m !== null) ids.sort(function (a, b) { return (b === m) - (a === m); });   // l'IDCC cherché en tête
      var shown = ids.slice(0, 8);
      var txt = shown.map(function (i) { return i === m ? "<b>" + i + "</b>" : i; }).join(", ") +
        (ids.length > 8 ? " +" + (ids.length - 8) : "");
      var why = r.why && m === null ? " · " + esc(r.why) : "";
      return '<button type="button" data-k="' + k + '"><div class="sn">' + esc(r.b.name) + "</div>" +
        '<div class="si">CPNE ' + r.b.code + " · IDCC " + txt + why + "</div></button>";
    }).join("");
    box.hidden = false;
  }

  function pickBranch(k) {
    var r = sugItems[k]; if (!r) return;
    state.branch = r.b; state.shown = PAGE;
    el("q-branch").value = r.b.name;
    el("clear-branch").hidden = false;
    el("suggest").hidden = true;
    renderPill();
    render();
    if (openCert !== null) refreshDetail();
  }

  function renderPill() {
    var slot = el("pill-slot");
    if (!state.branch) { slot.innerHTML = ""; return; }
    var b = state.branch;
    var others = [];
    b.idcc.forEach(function (i) {
      (IDCC2COLS[i] || []).forEach(function (c) { if (c !== b.col && others.indexOf(c) < 0) others.push(c); });
    });
    slot.innerHTML = '<div class="branchpill"><div>' +
      '<div class="bp-lab">Branche retenue · code CPNE ' + b.code + "</div>" +
      '<div class="bp-name">' + esc(b.name) + "</div>" +
      '<div class="bp-idcc">IDCC : ' + b.idcc.join(", ") + "</div>" +
      (others.length ? '<div class="bp-idcc" style="margin-top:4px">⚠︎ Un IDCC de cette branche est aussi rattaché à ' + others.length + " autre" + (others.length > 1 ? "s" : "") + " CPNE — vérifiez la CPNE dont relève l'employeur.</div>" : "") +
      '</div><button type="button" id="pill-clear">Changer de branche</button></div>';
  }

  function fmtDate(iso) {
    var p = (iso || "").split("-");
    if (p.length !== 3) return iso;
    var mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return (p[2] === "01" ? "1er" : String(parseInt(p[2], 10))) + " " + mois[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  /* ---------- évènements ---------- */
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  function wire() {
    var qf = el("q-form"), qb = el("q-branch");

    var doForm = debounce(function () { state.qf = qf.value; state.shown = PAGE; render(); }, 130);
    qf.addEventListener("input", function () { el("clear-form").hidden = !qf.value; doForm(); });
    el("clear-form").addEventListener("click", function () { qf.value = ""; el("clear-form").hidden = true; state.qf = ""; state.shown = PAGE; render(); qf.focus(); });

    qb.addEventListener("input", function () {
      el("clear-branch").hidden = !qb.value;
      if (!qb.value.trim()) { state.branch = null; renderPill(); render(); }
      renderSuggest(qb.value);
    });
    qb.addEventListener("focus", function () { if (qb.value.trim() && !state.branch) renderSuggest(qb.value); });
    qb.addEventListener("keydown", function (e) {
      var box = el("suggest");
      if (box.hidden || !sugItems.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sugHl = (sugHl + (e.key === "ArrowDown" ? 1 : -1) + sugItems.length) % sugItems.length;
        Array.prototype.forEach.call(box.querySelectorAll("button"), function (b, k) {
          b.classList.toggle("hl", k === sugHl); if (k === sugHl) b.scrollIntoView({ block: "nearest" });
        });
      } else if (e.key === "Enter") {
        e.preventDefault(); pickBranch(sugHl >= 0 ? sugHl : 0);
      } else if (e.key === "Escape") { box.hidden = true; }
    });
    el("suggest").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]"); if (b) pickBranch(+b.dataset.k);
    });
    el("clear-branch").addEventListener("click", function () {
      qb.value = ""; el("clear-branch").hidden = true; state.branch = null;
      el("suggest").hidden = true; renderPill(); render(); if (openCert !== null) refreshDetail(); qb.focus();
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#suggest") && e.target !== qb) el("suggest").hidden = true;
    });
    el("pill-slot").addEventListener("click", function (e) {
      if (e.target.id === "pill-clear") { qb.value = ""; qb.focus(); el("clear-branch").hidden = true; state.branch = null; renderPill(); render(); }
    });

    el("f-type").addEventListener("change", function () { state.type = this.value; state.shown = PAGE; render(); });
    el("f-sort").addEventListener("change", function () { state.sort = this.value; state.shown = PAGE; render(); });
    el("more").addEventListener("click", function () { state.shown += PAGE; render(); });
    el("btn-csv").addEventListener("click", csvResults);
    el("reset").addEventListener("click", function () {
      qf.value = ""; qb.value = ""; el("clear-form").hidden = true; el("clear-branch").hidden = true;
      state = { qf: "", qb: "", branch: null, type: "", sort: "rel", shown: PAGE, list: [] };
      el("f-type").value = ""; el("f-sort").value = "rel";
      renderPill(); render();
    });

    el("results").addEventListener("click", function (e) {
      var card = e.target.closest(".card[data-i]"); if (card) openDetail(+card.dataset.i);
    });
    el("p-close").addEventListener("click", closeDetail);
    el("overlay").addEventListener("mousedown", function (e) { if (e.target === el("overlay")) closeDetail(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el("overlay").hidden) closeDetail();
      if (e.key === "/" && document.activeElement === document.body) { e.preventDefault(); qf.focus(); }
    });

    var doTf = debounce(function (v) { tableFilter = v; var sc = el("p-body"); refreshDetail(); var f = el("tfilter"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 160);
    el("p-body").addEventListener("input", function (e) { if (e.target.id === "tfilter") doTf(e.target.value); });
    el("p-body").addEventListener("click", function (e) {
      if (e.target.id === "tcsv") { csvCert(openCert); return; }
      var th = e.target.closest("th[data-k]");
      if (th) {
        var k = th.dataset.k;
        if (tableSort.k === k) tableSort.dir *= -1; else tableSort = { k: k, dir: k === "name" ? 1 : -1 };
        refreshDetail();
      }
    });
  }

  /* ---------- démarrage ---------- */
  function inflate(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("DecompressionStream non supporté"));
    }
    var ds = new DecompressionStream("gzip");
    return new Response(new Blob([u]).stream().pipeThrough(ds)).text();
  }

  function boot() {
    var raw = document.getElementById("npec-payload").textContent.replace(/\s+/g, "");
    inflate(raw).then(function (txt) {
      D = JSON.parse(txt);
      buildIndex();
      el("m-date").textContent = fmtDate(D.meta.dateApplicabilite);
      el("m-cert").textContent = nf.format(D.meta.nCert);
      el("m-cpne").textContent = nf.format(D.meta.nCpne);
      el("m-idcc").textContent = nf.format(D.meta.nIdcc);
      el("src-line").innerHTML = "Source : <b>" + esc(D.meta.source) + "</b> — " +
        nf.format(D.meta.nCouples) + " couples certification × branche. Astuce : appuyez sur <span class=\"kbd\">/</span> pour rechercher.";
      var types = D.types.slice().sort(function (a, b) { return a.localeCompare(b, "fr"); });
      el("f-type").innerHTML = '<option value="">Tous les types</option>' +
        types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
      el("loading").hidden = true;
      el("ui").hidden = false;
      wire();
      render();
      el("q-form").focus();
    }).catch(function (e) {
      el("loading").innerHTML = "Impossible de charger les données : " + esc(e.message) +
        ".<br>Utilisez un navigateur récent (Chrome, Edge, Firefox ou Safari 16.4+).";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
