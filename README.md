# alternancepilot
Suivi intelligent des offres d'alternance

## Pages

- `index.html` — suivi des missions et contacts.
- `npec.html` — moteur de recherche du **référentiel unique des NPEC** applicable au
  1er septembre 2026 (France compétences, décret n° 2026-832 du 29 août 2026,
  mise à jour du 16 octobre 2026).
  Recherche par intitulé de formation, code RNCP, certificateur, n° IDCC ou nom de
  branche (CPNE) ; affiche le montant NPEC du couple certification × branche, les
  5 montants les plus élevés et les 5 plus bas par formation, la grille complète des
  203 branches et l'export CSV. Page autonome : les 745 213 couples du référentiel
  sont embarqués dans le fichier (426 Ko), aucun appel réseau n'est nécessaire.
  Régénération : voir `tools/README.md`.
