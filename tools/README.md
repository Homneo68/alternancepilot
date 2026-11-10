# Régénération de `npec.html`

`npec.html` est une page autonome (aucune dépendance réseau hors polices Google) qui
embarque le référentiel unique des NPEC de France compétences, compressé en gzip +
base64 et décompressé côté navigateur via `DecompressionStream`.

## Pipeline

Placer le fichier source de France compétences sous le nom `npec.xlsx` dans ce
dossier, puis :

```bash
python3 -m pip install openpyxl        # requis uniquement par le contrôle qualité
python3 extract.py                     # npec.xlsx  -> raw.json   (~35 s, 745 213 lignes)
python3 build.py                       # raw.json   -> npec-data.json (payload compact)
python3 assemble.py                    # + gabarits -> npec.html
```

`assemble.py` attend les gabarits `tpl_head.html`, `tpl_body.html` et
`tpl_js1..4.js` dans le même dossier ; ils sont conservés inlinés dans
`npec.html` (source de vérité). Pour une modification ponctuelle de l'interface,
éditer directement `npec.html` : seules les données sont générées.

## Format du payload

| Clé | Contenu |
| --- | --- |
| `cpne` | `[code CPNE, nom, [IDCC…]]` — l'ordre définit les colonnes de la matrice |
| `certs` | `[codes RNCP, libellé, index certificateur, index type de diplôme]` |
| `vals` | par certification, les montants NPEC distincts triés croissant |
| `map` | par certification, 203 caractères indexant `vals` (alphabet base 64) |
| `dec` | par certification, masque de bits base64 : 1 = statut « D » (décret) |

Cet encodage ramène les 745 213 couples certification × branche de 310 Mo de XML
à 282 Ko compressés, sans perte : `build.py` est vérifié par round-trip complet
cellule à cellule contre `raw.json`.

## Anomalie source connue

Dans le référentiel du 1er septembre 2026 (y compris la mise à jour du 16 octobre 2026), la cellule « NPEC final » du couple
`RNCP41381` × CPNE 224 (COPANIEF - Fabricant de sucres) contient un libellé de
CPNE au lieu d'un montant. La valeur est traitée comme indisponible (`n.d.`) et
signalée à l'utilisateur dans la fiche.
