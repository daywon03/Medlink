# 🔒 Audit de Sécurité — Medlink

## Contexte

Medlink est une application de régulation médicale d'urgence (SAMU) composée d'un backend NestJS, d'un frontend Next.js, et d'une base Supabase. Ce document recense les **5 pratiques de code sécurisé** appliquées au projet.

---

## Pratique 1 — Séparation des secrets et variables d'environnement

| Élément           | Détail                                                |
| ----------------- | ----------------------------------------------------- |
| **Risque OWASP**  | A05:2021 – Security Misconfiguration                  |
| **Mise en œuvre** | Fichiers `.env` exclus du versioning via `.gitignore` |

Toutes les clés sensibles (Supabase, Groq, ElevenLabs, Google Maps) sont stockées dans des fichiers `.env` distincts par environnement. Le `.gitignore` racine exclut explicitement :

```
.env
.env.*
!.env.example
```

Un fichier `.env.example` est fourni avec des valeurs placeholder pour guider la configuration sans exposer de secrets. Les clés sont lues via `process.env` (backend) et `NEXT_PUBLIC_*` (frontend, clés publiques uniquement).

---

## Pratique 2 — CORS (Cross-Origin Resource Sharing)

| Élément           | Détail                                               |
| ----------------- | ---------------------------------------------------- |
| **Risque OWASP**  | A01:2021 – Broken Access Control                     |
| **Mise en œuvre** | CORS activé sur l'API REST et les WebSocket Gateways |

Le backend NestJS active CORS à deux niveaux :

- **API REST** (`main.ts`) : `NestFactory.create(AppModule, { cors: true })` — autorise les requêtes cross-origin depuis le frontend.
- **WebSocket Gateways** (`arm.gateway.ts`, `tracking.gateway.ts`) : origines restreintes via la variable `ALLOWED_ORIGINS` :

```typescript
cors: {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
}
```

> **Recommandation** : en production, remplacer `cors: true` dans `main.ts` par une liste blanche explicite d'origines.

---

## Pratique 3 — Séparation des clés anon / service_role (Supabase RLS)

| Élément           | Détail                                                    |
| ----------------- | --------------------------------------------------------- |
| **Risque OWASP**  | A01:2021 – Broken Access Control                          |
| **Mise en œuvre** | Clé `anon` côté frontend, clé `service_role` côté backend |

Le projet utilise deux clés Supabase distinctes :

| Clé                             | Environnement      | Permissions                                    |
| ------------------------------- | ------------------ | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (Next.js) | Respecte les Row Level Security (RLS) policies |
| `SUPABASE_SERVICE_KEY`          | Backend (NestJS)   | Bypass RLS — accès complet (admin)             |

La clé `service_role` n'est **jamais** exposée côté client. Seule la clé `anon` (publique par design) est préfixée `NEXT_PUBLIC_` pour être accessible dans le navigateur.

---

## Pratique 4 — Validation et sanitisation des entrées utilisateur

| Élément           | Détail                                                               |
| ----------------- | -------------------------------------------------------------------- |
| **Risque OWASP**  | A03:2021 – Injection                                                 |
| **Mise en œuvre** | Validation côté `collectInfoAction` + Supabase parameterized queries |

Les entrées utilisateur sont validées à plusieurs niveaux :

- **Extraction d'adresse** (`collect-info.action.ts`) : regex strictes avec normalisation (`normalizeAddress()`) qui supprime les caractères dangereux et limite la longueur (minimum 8 caractères).
- **Extraction d'âge** : validation numérique bornée (0-150) dans `GroqExtractionService.validateAge()`.
- **Requêtes Supabase** : le SDK Supabase utilise des requêtes paramétrées (`.eq()`, `.ilike()`) — pas de concaténation SQL directe, empêchant les injections SQL.
- **Réponses IA** : les sorties JSON de Groq sont parsées avec `JSON.parse()` dans un bloc `try/catch`, et chaque champ est validé individuellement (type, bornes, valeurs autorisées).

---

## Pratique 5 — Architecture Clean et principe du moindre privilège

| Élément           | Détail                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| **Risque OWASP**  | A04:2021 – Insecure Design                                               |
| **Mise en œuvre** | Clean Architecture avec séparation Domain / Application / Infrastructure |

L'architecture du backend applique le principe de séparation des responsabilités :

- **Domain** : entités pures sans dépendance externe (`Call`, `ExtractedData`, `TriageReport`).
- **Application** : interfaces de repository + use cases. Les use cases n'accèdent à la base que via des interfaces abstraites — impossible d'exécuter des requêtes arbitraires.
- **Infrastructure** : implémentations Supabase injectées via DI NestJS. Le changement de base de données ne nécessite que de remplacer les implémentations.

Cette séparation réduit la surface d'attaque : un compromis dans la couche présentation ne donne pas accès direct à la base de données.

---

## Synthèse

| #   | Pratique                                  | OWASP | Statut        |
| --- | ----------------------------------------- | ----- | ------------- |
| 1   | Secrets dans `.env` + `.gitignore`        | A05   | ✅ Implémenté |
| 2   | CORS configuré (API + WebSocket)          | A01   | ✅ Implémenté |
| 3   | Séparation clés anon / service_role       | A01   | ✅ Implémenté |
| 4   | Validation entrées + requêtes paramétrées | A03   | ✅ Implémenté |
| 5   | Clean Architecture + moindre privilège    | A04   | ✅ Implémenté |
