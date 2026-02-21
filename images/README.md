# Dossier Images

Placez vos images pédagogiques ici.

## Comment utiliser

Dans `data.js`, ajoutez un champ `image` à la section `prediction` ou `explanation` d'une activité :

```javascript
// Image unique
image: {
  src: "images/mon_image.png",
  caption: { fr: "Description en français", ar: "الوصف بالعربية" }
}

// Plusieurs images (dans explanation uniquement)
images: [
  { src: "images/image1.png", caption: { fr: "Image 1", ar: "الصورة 1" } },
  { src: "images/image2.png", caption: { fr: "Image 2", ar: "الصورة 2" } }
]
```

## Formats recommandés
- **PNG** ou **JPG** pour les photos/schémas
- **SVG** pour les formules et diagrammes vectoriels
- Taille recommandée : largeur max **800px** pour un bon affichage mobile
