# 📦 Bibliothèques locales (offline)

Ces fichiers sont pré-cachés par le Service Worker pour un usage **hors ligne**.

## Fichiers disponibles

| Bibliothèque | Fichier | Version | Usage |
|---|---|---|---|
| **Three.js** | `three.min.js` | r134 | Rendu 3D (WebGL) |
| **p5.js** | `p5.min.js` | 1.11.11 | Dessin/animation Canvas 2D |
| **Matter.js** | `matter.min.js` | 0.20.0 | Moteur physique 2D |
| **Tailwind CSS** | `tailwindcss.js` | 3.4.17 | Classes CSS utilitaires |

## Utilisation dans une simulation

Les simulations sont dans `simulations/`. Utilisez des chemins relatifs `../libs/` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ma Simulation</title>
    
    <!-- Tailwind CSS (optionnel) -->
    <script src="../libs/tailwindcss.js"></script>
</head>
<body>
    <canvas id="canvas"></canvas>

    <!-- Choisir la lib selon le besoin : -->
    <script src="../libs/three.min.js"></script>   <!-- 3D -->
    <script src="../libs/p5.min.js"></script>       <!-- Canvas 2D -->
    <script src="../libs/matter.min.js"></script>   <!-- Physique 2D -->
    
    <script>
        // Votre code de simulation ici
    </script>
</body>
</html>
```

## Ajouter une nouvelle bibliothèque

1. Télécharger le fichier `.min.js` dans ce dossier `libs/`
2. Ajouter le chemin dans `service-worker.js` → tableau `PRECACHE_ASSETS`
3. Incrémenter `CACHE_VERSION` dans `service-worker.js`
