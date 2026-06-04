# EdgeStat

Application web d'analyse statistique de paris sportifs (football + tennis).
Front React (Vite) repris d'une maquette validée, backend Node/Express servant
de proxy vers **API-Football** avec cache disque.

> **Outil d'analyse, pas de prédiction.** Toutes les valeurs sont des
> fréquences historiques. Aucune probabilité de gain n'est calculée. Les paris
> comportent un risque de perte.

## Architecture

```
edgestat/
├── backend/     # Express : proxy API-Football + cache (clé API côté serveur uniquement)
└── frontend/    # Vite + React : la maquette, branchée sur le backend
```

- **Football** : vraies données API-Football (6 championnats : France, Angleterre,
  Italie, Allemagne, Espagne, Portugal). Pour chaque ligue, le **prochain match**
  programmé est analysé sur 4 onglets : Victoire/Défaite, Buteur, Buts par match, Penalty.
- **Tennis** : données fictives (placeholder) — API-Football ne couvre pas le tennis.
- **Antériorité** : saison en cours + précédente uniquement (~1 an), pour rester
  sur le tier gratuit puis Pro sans add-on historique.
- **Cache** : réponses mises en cache sur disque plusieurs heures + garde-fou de
  quota quotidien, pour rester sous les 100 requêtes/jour du tier gratuit.

## Démarrage

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # puis renseigne API_FOOTBALL_KEY dans .env
npm run dev                 # http://localhost:3001
```

Obtenir une clé gratuite : https://www.api-football.com/ (tier gratuit, 100 req/jour).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

En dev, Vite relaie `/api` vers le backend : **la clé API ne transite jamais par
le navigateur**.

### Production (un seul port)

```bash
cd frontend && npm run build      # génère frontend/dist
cd ../backend && npm start        # sert l'API + le frontend buildé sur le PORT
```

## Endpoints backend

| Route             | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `GET /api/football` | Les 6 ligues agrégées (format prêt pour l'affichage).  |
| `GET /api/leagues`  | Liste des championnats (sélecteur).                    |
| `GET /api/health`   | État : clé présente, compteur d'appels du jour, quota. |

`GET /api/football?refresh=1` force la reconstruction (ignore le cache du payload).

## Limites du tier gratuit (substituts assumés)

API-Football ne fournit pas certaines métriques fines à bas coût. Les substituts,
fidèles à la règle « fréquence historique » :

- **Buteur** : « X buts en Y matchs joués » (au lieu de « a marqué dans X de ses Y matchs »).
- **Split domicile/extérieur** du buteur : non affiché (indisponible en gratuit).
- **Penalty concédés** : non affiché ; on montre obtenus + taux de conversion.

Le code laisse ces champs optionnels : ils s'afficheront automatiquement si une
source plus riche (tier Pro) les fournit un jour.

## Budget de requêtes

~42 appels par reconstruction complète (6 ligues). Avec un cache de plusieurs
heures (2 reconstructions/jour max) → ~84 appels/jour, sous la limite de 100.
Le garde-fou `DAILY_REQUEST_LIMIT` sert le cache (même périmé) au-delà du seuil.
