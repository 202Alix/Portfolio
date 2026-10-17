# Éditeur de projets — Guide

## Principe général

L'éditeur est un CMS visuel intégré au projet, accessible uniquement en mode développement local. Il permet de créer et modifier des fiches projets sans toucher au code. Chaque projet est stocké dans un fichier `.json` indépendant, et le portfolio les charge automatiquement.

```
Éditeur → JSON → Portfolio
```

---

## Accès

Lancer le serveur de développement :

```bash
npm run dev
# ou
pnpm dev
```

Puis ouvrir dans le navigateur :

```
http://localhost:5173/?editor=true
```

> L'éditeur **n'existe pas en production**. Si vous déployez sur Vercel / Cloudflare, il est invisible pour les visiteurs.

---

## Architecture des fichiers

```
src/
├── data/
│   ├── index.ts              ← charge automatiquement tous les JSON
│   └── projects/
│       ├── manifold.json     ← un fichier par projet
│       ├── noir-blanc.json
│       └── ...
├── editor/
│   └── Editor.tsx            ← interface de l'éditeur
└── types.ts                  ← types partagés (Project, ContentBlock…)

public/
└── projects/
    └── [id-projet]/
        └── image.jpg         ← images uploadées via l'éditeur
```

**Règle simple :** ajouter un fichier `.json` dans `src/data/projects/` suffit à faire apparaître le projet dans le portfolio au prochain rechargement. Supprimer le fichier le retire.

---

## Flux de travail

### Créer un nouveau projet

1. Ouvrir l'éditeur (`/?editor=true`)
2. Cliquer **"Nouveau projet"** dans la sidebar gauche
3. Remplir les métadonnées (voir section suivante)
4. Ajouter des blocs de contenu
5. Cliquer **"Enregistrer"** → le fichier `src/data/projects/[id].json` est créé
6. Retourner sur le portfolio → le projet apparaît

### Modifier un projet existant

1. Ouvrir l'éditeur
2. Cliquer sur le projet dans la sidebar
3. Modifier les champs ou les blocs
4. Cliquer **"Enregistrer"**

### Prévisualiser avant d'enregistrer

Cliquer **"Aperçu"** → ouvre un nouvel onglet avec la fiche projet rendue dans le vrai portfolio (données depuis `localStorage`, non sauvegardées).

---

## Métadonnées d'un projet

| Champ | Description |
|---|---|
| **Titre** | FR + EN — nom affiché sur la carte et la fiche |
| **Sous-titre** | FR + EN — ligne sous le titre |
| **Année** | Ex. `2024` |
| **Index** | Ordre d'affichage — `01`, `02`… |
| **Catégorie** | Filtre principal sur la landing |
| **ID** | Slug URL — généré automatiquement, modifiable |
| **Tags** | FR + EN — filtres secondaires, cliquables sur la fiche |
| **Extrait** | FR + EN — texte affiché sur la carte projet |
| **Image de couverture** | Affichée sur la carte + en tête de fiche |

### Auto-remplissage bilingue (Titre + Tags)

Pour **Titre** et **Tags**, l'éditeur copie automatiquement la première version saisie vers l'autre langue si celle-ci est vide.

Exemple :
- vous saisissez le titre en FR
- le champ EN reçoit la même valeur automatiquement
- vous pouvez ensuite modifier EN librement sans écraser FR

Le même comportement s'applique aux tags.

---

## Blocs de contenu

Les blocs forment le corps de la fiche projet. On peut les **ajouter, supprimer et réordonner** par glisser-déposer.

Le menu **Ajouter un bloc** s'ouvre vers le bas sous le bouton, pour rester visible même lorsque vous êtes proche de l'en-tête.

### Texte
Paragraphe simple. Deux champs : texte principal + texte secondaire (optionnel). Les deux en FR + EN.

### Image
Une image positionnée :
- **Gauche** — occupe la moitié gauche
- **Droite** — occupe la moitié droite
- **Pleine page** — bord à bord

Chaque image a un champ `alt` (accessibilité) et une légende optionnelle (FR + EN).

### Vidéo
Fichier vidéo hébergé. URL directe vers un `.mp4` ou chemin local après upload. Même système de position que l'image.

### YouTube
URL d'une vidéo YouTube — l'éditeur génère automatiquement l'URL d'embed. Même système de position.

### Avant / Après
Deux images superposées séparées par une ligne qu'on fait glisser (souris, doigt ou flèches du clavier) pour comparer une retouche. Même système de position, et disponible aussi dans une colonne.

Les deux images doivent avoir **exactement les mêmes dimensions et le même cadrage** : c'est l'image « Après » qui fixe la taille du bloc. Pas de recadrage, hauteur limitée à 80 % de l'écran. À l'apparition, la ligne fait un petit aller-retour pour montrer qu'elle est interactive.

### Colonnes
Deux colonnes côte à côte. Chaque colonne peut contenir indépendamment un **Texte**, une **Image** ou une **Vidéo**.

Exemple typique : image à gauche + texte explicatif à droite.

### Masonry
Grille de photos en mosaïque (style galerie). Ajouter autant d'images que souhaité — la grille s'adapte automatiquement au nombre d'images.

---

## Upload d'images

L'upload fonctionne uniquement en dev local (le serveur Vite intercepte les requêtes).

**Méthode :**
1. Dans un bloc image (ou l'image de couverture), glisser-déposer un fichier ou cliquer pour sélectionner
2. Le fichier est envoyé au serveur → copié dans `public/projects/[id]/[nom-fichier]`
3. Le champ est rempli automatiquement avec le chemin `/projects/[id]/nom-fichier.jpg`

**En production**, ces fichiers sont dans `public/` donc servis statiquement par Vercel / Cloudflare.

> Pour des images déjà en ligne, coller directement l'URL dans le champ texte sous la zone d'upload.

---

## Bilingue (FR / EN)

Tous les champs de texte affichant du contenu au visiteur existent en deux versions : **FR** et **EN**. Un seul interrupteur FR/EN, en haut de l'éditeur (à côté de "Aperçu" / "Enregistrer"), pilote toute la page : il bascule en même temps le titre, les tags, tous les blocs de contenu et les images/vidéos, pour éviter de devoir changer de langue bloc par bloc.

Les champs **Titre** et **Tags** suivent aussi ce fonctionnement bilingue.

Le visiteur bascule entre les langues via le toggle FR/EN dans la navigation du portfolio.

---

## Suppression d'un projet

Dans la sidebar, passer la souris sur un projet → icône corbeille → confirmation → le fichier JSON est supprimé, le projet disparaît du portfolio.

---

## Limites

- L'éditeur nécessite que le **serveur de dev soit lancé** (`npm run dev`). Il ne fonctionne pas sur le site en ligne.
- Les images uploadées sont copiées dans `public/` — elles seront incluses dans le déploiement si elles sont présentes au moment du build.
- Il n'y a pas de système d'authentification : l'éditeur est simplement inaccessible en production (le code est exclu du bundle).
