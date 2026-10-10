# Mountain Kings

Jeu coop sur téléphone (Téo et sa compagne) : village nain 3D, raids solo contre les orques, raids à deux en direct, ligue de médailles. Le propriétaire ne code pas : expliquer simplement, en français.

## Structure
- `src/` : sources du jeu, concaténées dans cet ordre en un seul `docs/game.js` (IIFE) :
  - `p0_fb.js` : adaptateur Firebase (Realtime Database + Google Auth) qui imite l'API `db`/`room` des artefacts Claude ; `IMPORT_V` = village repris de l'ancienne version (`import_village.json`).
  - `p2_rules.js` : règles, simulation hors ligne déterministe, moteur de combat (10 Hz).
  - `p3_render.js` : rendu three.js r128 (caméra isométrique, modèles KayKit dans `docs/models/`).
  - `p4_app.js` : interface, sauvegarde, protocole du raid à deux, démarrage.
  - `p1_head.html` : CSS + squelette HTML.
- `docs/` : site publié par GitHub Pages (`https://teodico-cloud.github.io/Mountain-Kings/`). `docs/models/` et `docs/lib/` sont des fichiers fixes ; le reste est généré.
- `tools/build.py` : génère `docs/index.html`, `game.js`, `sw.js` (cache hors ligne + mises à jour auto), `manifest.json`, icônes, `database.rules.json`.
- `tools/fakeserver.py` + `tools/fakefb.js` : faux Firebase pour tester à deux joueurs en local (`python3 tools/build.py --test`, puis `tools/test_duo.py`). Toujours reconstruire SANS `--test` avant de committer.

## Règles
- Ne jamais committer un build `--test` (vérifier que `docs/index.html` charge gstatic firebasejs, pas `fakefb.js`).
- Une sauvegarde de village doit rester compatible (`VERSION` dans `p2_rules.js`) : les joueurs ont des données réelles dans Firebase.
- Les règles RTDB dans `database.rules.json` sont collées à la main par Téo dans la console Firebase : le prévenir si elles changent.
