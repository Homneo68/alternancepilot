/* =========================================================================
   Référentiel NPEC — moteur de recherche
   Données : France compétences, référentiel unique des NPEC (1er sept. 2026)
   ========================================================================= */
(function () {
  "use strict";

  var ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
  var AIDX = {};
  for (var i = 0; i < ALPHA.length; i++) AIDX[ALPHA.charAt(i)] = i;

  var D = null;            // payload
  var CERTS = [];          // enrichis : {i, rncp, lib, cert, type, hay, codes[]}
  var BRANCHES = [];       // {col, code, name, idcc[], hay}
  var IDCC2COLS = {};      // idcc -> [col…]
  var statCache = [];      // stats par certification
  var decCache = [];       // bitmask "D" décodé
  var PAGE = 60;

  var state = { qf: "", qb: "", branch: null, type: "", sort: "rel", shown: PAGE, list: [] };

  var euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  var nf = new Intl.NumberFormat("fr-FR");
  function money(v) { return v === null || v === undefined ? "n.d." : euro.format(v); }

  function norm(s) {
    return (s || "").toString().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’'`]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function esc(s) {
    return (s || "").toString().replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  /* ---------- accès aux valeurs ---------- */
  function npec(ci, col) { return D.vals[ci][AIDX[D.map[ci].charAt(col)]]; }

  function isDecret(ci, col) {
    var b = decCache[ci];
    if (!b) {
      var bin = atob(D.dec[ci]);
      b = decCache[ci] = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k);
    }
    return (b[col >> 3] >> (7 - (col & 7))) & 1 ? true : false;
  }

  function stats(ci) {
    if (statCache[ci]) return statCache[ci];
    var vs = [], n = D.cpne.length, miss = 0;
    for (var c = 0; c < n; c++) {
      var v = npec(ci, c);
      if (v === null || v === undefined) miss++; else vs.push(v);
    }
    vs.sort(function (a, b) { return a - b; });
    var sum = 0; for (var j = 0; j < vs.length; j++) sum += vs[j];
    var med = vs.length ? (vs.length % 2 ? vs[(vs.length - 1) / 2]
      : Math.round((vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2)) : null;
    var s = {
      min: vs.length ? vs[0] : null,
      max: vs.length ? vs[vs.length - 1] : null,
      med: med,
      moy: vs.length ? Math.round(sum / vs.length) : null,
      nb: vs.length, miss: miss,
      distinct: D.vals[ci].filter(function (v) { return v !== null; }).length
    };
    statCache[ci] = s;
    return s;
  }

  /* Regroupe les branches par montant, trié décroissant. */
  function groups(ci) {
    if (statCache[ci] && statCache[ci]._g) return statCache[ci]._g;
    var byVal = new Map();
    for (var c = 0; c < D.cpne.length; c++) {
      var v = npec(ci, c);
      if (v === null || v === undefined) continue;
      if (!byVal.has(v)) byVal.set(v, []);
      byVal.get(v).push(c);
    }
    var g = Array.from(byVal.entries())
      .map(function (e) { return { v: e[0], cols: e[1] }; })
      .sort(function (a, b) { return b.v - a.v; });
    stats(ci)._g = g;
    return g;
  }
