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
- `tools/meshy_import.py` : allège un GLB Meshy (1-2 millions de triangles, textures 4K, 60-90 Mo) pour le téléphone → `docs/v2/models/`. Textures : couleur 1024, relief 512, métal/rugosité 256. Simplification par `gltfpack` (meshoptimizer, compilé depuis GitHub : `git clone https://github.com/zeux/meshoptimizer && make config=release gltfpack`, puis `GLTFPACK=…/build/release/gltfpack`), JAMAIS en mode agressif (`-sa`) : il casse les textures (atlas très fragmentés). Le simplificateur s'arrête seul à la limite qui garde les textures (≈ 36 000 triangles pour la taverne, 15 000 pour un personnage). Les personnages doivent être animés dans Meshy (Rig + Animate) : sans squelette, ils glissent comme des statues.
- `tools/test_v2.js` : essais des règles du nouveau jeu (node).

## Façon de travailler (demandée par Téo)
- Avant chaque implémentation : lui présenter ce qu'on veut faire, avec des propositions annexes, et attendre son accord avant de coder.

## Refonte (décidée le 11 oct. 2026, conception en cours, rien de codé)
- Remise à zéro : nouveau jeu sur une sauvegarde neuve (chemin Firebase séparé), anciens villages archivés, jamais effacés. Construit à une adresse de test séparée ; l'ancien jeu reste jouable jusqu'au remplacement.
- Un seul village commun aux deux joueurs, vue isométrique. Gestion façon Medieval Dynasty : villageois avec métier, nom et caractère (progressent dans leur métier), chaînes de production, besoins, saisons.
- Chaque joueur n'a qu'un héros : race + classe au choix, toutes combinaisons. Races : Humain, Nain, Elfe, Orque, Halfelin, Mort-vivant (3 au début). Classes : Guerrier, Rôdeur, Mage, Prêtre, Voleur (3 au début). Au village le héros se promène comme un PNJ ; on peut l'affecter à un bâtiment (bonus de race).
- RPG : niveaux, compétences de classe, équipement du héros (arme, casque, armure, bottes, bijou), 5 raretés (commun → légendaire), ensembles, forge (fabriquer, améliorer), familier, marchand ambulant.
- Combat : donjons et boss seulement (plus de raids de camps). Joystick pour bouger (en donjon seulement), attaques automatiques, 3 compétences + potion sur boutons. Solo ou à deux en direct. Combos à deux, les Profondeurs (donjon sans fin). Annexes proposées sans réponse : roulade, apparence, races secrètes, duos de races, visée manuelle.
- Défense : gobelins menés par des trolls, seulement quand les deux joueurs sont absents ; vol de ressources, butin qui s'échappe (récupérable si arrêtés avant la sortie), pièges, tours, palissade, rediffusion.
- Garnison : Caserne (3 → 12 soldats), 4 types (fantassin, archer, lancier, mage de guerre). Postes de garde (1 → 4 selon la Caserne) : une zone en cercle chacun, plusieurs gardes par poste, ils ne quittent jamais leur zone ; formation automatique ; amélioration du poste (cercle plus grand) ; bannière par poste = objet à gagner, avec rareté, bonus aux gardes de la zone ; bouton de répartition rapide. Soldats : XP en survivant, montée de niveau choisie par le joueur contre des ressources (jusqu'au niveau 15), entretien en nourriture qui augmente avec le niveau ; équipement = une arme + un ensemble d'armure complet (pas de pièces séparées), avec bonus d'ensemble ; 3 emplacements d'orbes de défense par soldat (niveaux 4, 8, 12), orbes avec rareté gagnés en défense réussie ou donjon réussi, effets variés (vie, armure, régénération, épines, esquive), fusion 3 → 1 de rareté supérieure.
- Visuels : modèles générés par Téo avec Meshy (pas de connecteur Claude, et le workspace ne joint pas meshy.ai : il envoie les GLB dans la conversation). Style « hand-painted fantasy RTS/MMO ». Personnages en A-pose, mains vides ; armes = modèles séparés accrochés à la main. Formule gratuite = licence CC BY : citer Meshy dans l'aide. Premier test : guerrier humain, taverne, gobelin.
- Étapes : 1 village commun + héros ; 2 combats + donjons ; 3 équipement ; 4 défense + garnison ; 5 finitions. Présenter le détail de chaque étape avant de coder.

## Règles
- Ne jamais committer un build `--test` (vérifier que `docs/index.html` charge gstatic firebasejs, pas `fakefb.js`).
- Une sauvegarde de village doit rester compatible (`VERSION` dans `p2_rules.js`) : les joueurs ont des données réelles dans Firebase.
- Les règles RTDB dans `database.rules.json` sont collées à la main par Téo dans la console Firebase : le prévenir si elles changent.
- Tout changement du combat ou des messages du raid à deux : incrémenter `APP_PV` (p2_rules.js). Les deux joueurs doivent avoir la même version pour jouer ensemble.
- Remparts : bâtiments `rempart` de taille 1 dans `v.b` (pose et amélioration instantanées). Héros : `v.heroes[k] = {lvl, rest, up}`.
