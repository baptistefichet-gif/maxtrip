# MaxTrip - base de développement

Application web personnelle pour explorer les destinations et trajets du jeu de données TGV MAX.

## Démarrage

Prérequis : Node.js 20+

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## Technologies

- Next.js et TypeScript
- Tailwind CSS
- React Leaflet et OpenStreetMap
- Route serveur pour Explore API SNCF 2.1

## À finaliser avant de l'utiliser pour préparer un voyage

- Vérifier les noms exacts de champs dans les réponses API SNCF et ajuster le mapping.
- Parcourir toutes les pages, pas uniquement un échantillon de 100 enregistrements.
- Construire le vrai moteur de correspondances et le rapprochement aller-retour.
- Ajouter un référentiel complet de gares avec coordonnées fiables.
- Valider la disponibilité MAX pour chaque segment.
- Ajouter les règles de transfert inter-gares avec une source de transport vérifiable.
- Exécuter les tests et la construction de production.

Les disponibilités Open Data sont indicatives, non une confirmation de réservation. MaxTrip est un projet indépendant.
