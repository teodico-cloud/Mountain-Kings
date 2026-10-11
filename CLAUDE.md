# Mountain Kings

Jeu coop sur téléphone (Téo et sa compagne) : village nain 3D, raids solo contre les orques, raids à deux en direct, ligue de médailles. Le propriétaire ne code pas : expliquer simplement, en français.

## Structure
- `src/` : sources du jeu, concaténées dans cet ordre en un seul `docs/game.js` (IIFE) :
  - `p0_fb.js` : adaptateur Firebase (Realtime Database + Google Auth) qui imite l'API `db`/`room` des artefacts Claude ; `IMPORT_V` = village repris de l'ancienne version (`import_village.json`).
  - `p2_rules.js` : règles, simulation hors ligne déterministe, moteur de combat (10 Hz).
  - `p3_render.js` : rendu three.js r128 (caméra isométrique, modèles KayKit dans `docs/models/`).
  - `p5_audio.js` : musique (taverne) et bruitages, tout synthétisé en WebAudio (`SND`).
  - `p4_app.js` : interface, sauvegarde, protocole du raid à deux, tutoriel, aide, démarrage.
  - `p1_head.html` : CSS + squelette HTML.
  Ordre de concaténation : p0, p2, p3, p5, p4.
- `docs/` : site publié par GitHub Pages (`https://teodico-cloud.github.io/Mountain-Kings/`). `docs/models/` et `docs/lib/` sont des fichiers fixes ; le reste est généré.
- `tools/build.py` : génère `docs/index.html`, `game.js`, `sw.js` (cache hors ligne + mises à jour auto), `manifest.json`, icônes, `database.rules.json`.
- `tools/fakeserver.py` + `tools/fakefb.js` : faux Firebase pour tester en local (`python3 tools/build.py --test`, puis `tools/test_ui.py` et `tools/test_duo.py`). Le build de test expose `window.__mk` pour les essais. Toujours reconstruire SANS `--test` avant de committer. Avec le rendu logiciel (swiftshader) ces essais sont lents (≈ 10 min pour `test_ui`, 15 min pour `test_duo`) : les lancer en arrière-plan avec `python3 -u` et un fichier de log.
- `tools/test_engine.js` : essais du moteur (remparts, chemins, héros) avec node.
- `tools/make_thumbs.py` : vignettes `docs/thumbs/*.png` rendues depuis les modèles 3D (à relancer si les modèles changent).
- `tools/models_pipeline.py` : conversion des modèles KayKit (CC0) vers `docs/models/`.

## Façon de travailler (demandée par Téo)
- Avant chaque implémentation : lui présenter ce qu'on veut faire, avec des propositions annexes, et attendre son accord avant de coder.

## Refonte demandée (11 oct. 2026)
Choix de Téo : remise à zéro (nouvelle sauvegarde, anciens villages archivés, pas effacés), un seul village commun aux deux joueurs, chacun joue un seul héros avec une classe au choix, gestion des ressources façon Medieval Dynasty, RPG (compétences, armes et armures avec rareté), combat semi-automatique (on choisit où va le héros et quand lancer les compétences), attaques en donjons avec boss, orques qui attaquent le village seulement en l'absence des joueurs (façon Dungeon Keeper : vol de ressources, pièges, gardes, rediffusion).

## Règles
- Ne jamais committer un build `--test` (vérifier que `docs/index.html` charge gstatic firebasejs, pas `fakefb.js`).
- Une sauvegarde de village doit rester compatible (`VERSION` dans `p2_rules.js`) : les joueurs ont des données réelles dans Firebase.
- Les règles RTDB dans `database.rules.json` sont collées à la main par Téo dans la console Firebase : le prévenir si elles changent.
- Tout changement du combat ou des messages du raid à deux : incrémenter `APP_PV` (p2_rules.js). Les deux joueurs doivent avoir la même version pour jouer ensemble.
- Remparts : bâtiments `rempart` de taille 1 dans `v.b` (pose et amélioration instantanées). Héros : `v.heroes[k] = {lvl, rest, up}`.
