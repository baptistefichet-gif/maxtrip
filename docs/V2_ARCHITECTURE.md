# MaxTrip V2 — Réseau TGV MAX préparé par date

## Objectif
Conserver la V1 publique sur `main`. Développer V2 sur `v2/precomputed-sncf-network` sans dépendre des appels SNCF à chaque recherche utilisateur.

## Architecture cible
1. **Import quotidien** : récupérer les pages SNCF TGV MAX par date, en reprenant les pages en échec et en enregistrant l'heure et la version de l'import.
2. **Stockage persistant** : base de données (Postgres recommandé) avec les segments disponibles, identifiants de trains, dates, gares et horaires. Ne pas dépendre de la mémoire d'une fonction Vercel.
3. **Index de graphe** : indexer les départs par date/gare/heure. Construire les correspondances à la demande depuis ces segments locaux, sans interroger toutes les gares SNCF à chaque clic.
4. **Recherche** : Explorer découvre les destinations, Trajet classique cible une arrivée, et l'aller-retour vérifie les deux directions et l'ordre chronologique.
5. **Classement** : limite de 7 h par sens, correspondances réalisables, dominance à 15 minutes, gares distinctes, destinations diversifiées avant pagination.
6. **Carte** : géolocalisation par identifiant de gare fiable, ne jamais tracer une liaison avec des coordonnées manquantes.
7. **Actualisation** : fraîcheur des données affichée, vérification finale SNCF Connect et cache invalidé à chaque nouvel import.

## Invariants de sécurité et de qualité
- Une page SNCF manquante marque l'import comme incomplet ; ne pas annoncer une recherche exhaustive.
- L'import doit être idempotent et atomique : une version incomplète ne remplace pas une version complète.
- Les retours le même jour partent strictement après l'arrivée de l'aller, avec dates absolues pour les trains de nuit.
- Aucun résultat ne dépasse 420 minutes par sens, attente comprise.
- Les alternatives dominées restent consultables, avec compteur par destination.
- Les résultats paginés sont classés *après* découverte de toutes les destinations de l'import.
- Éviter de présenter les segments SNCF comme des réservations garanties.

## Phases de réalisation
- [ ] Définir schéma SQL, migrations et connexion sécurisée à une base persistante.
- [ ] Développer import paginé avec reprise, dédoublonnage, validation et version atomique.
- [ ] Développer moteur de graphe et tests des quatre cas de pertinence.
- [ ] Construire API V2 de recherche et pagination stable.
- [ ] Brancher Explorer, carte, Trajet classique et allers-retours.
- [ ] Tests comparatifs Paris, Lyon, Marseille, avec/sans retour et dates différentes.
- [ ] Tests de charge, coûts Vercel/SNCF, temps de réponse, fraîcheur et absence de régression.
- [ ] Préproduction V2 et bascule contrôlée, avec possibilité de retour à V1.

## Prérequis de mise en service
Choisir et connecter une base persistante, prévoir le mécanisme de planification des imports et vérifier les conditions d'utilisation des données SNCF. Aucune bascule en production avant tests concluants.
