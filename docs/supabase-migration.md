# Migrer / appliquer la migration SQL dans Supabase

Fichier SQL: `db/patients.sql` (créé dans le dépôt)

Options pour appliquer la migration :

1) Avec l'interface Supabase (SQL Editor)
- Ouvrir votre projet Supabase → SQL Editor → coller le contenu de `db/patients.sql` → Run.

2) Avec `psql` (depuis PowerShell)
- Récupérez la connection string depuis Supabase (Settings → Database → Connection string). Exemple :

```
$env:SUPABASE_DB_URL = "postgresql://postgres:YOUR_PASSWORD@db.host.supabase.co:5432/postgres"
psql $env:SUPABASE_DB_URL -f .\db\patients.sql
```

3) Avec le CLI Supabase (si installé)
- Exemple (remplacez `project-ref` et configurez `supabase login` si nécessaire) :

```
supabase db remote set "postgresql://postgres:YOUR_PASSWORD@db.host.supabase.co:5432/postgres"
psql $env:SUPABASE_DB_URL -f .\db\patients.sql
```

Remarques
- Utiliser la `SERVICE_ROLE` key (`SUPABASE_SERVICE_KEY`) si vous exécutez des scripts automatisés côté serveur.
- Vérifiez que l'extension `pgcrypto` est autorisée sur votre projet Supabase (le SQL contient `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`). Si Supabase ne permet pas les extensions sur certains plans, adaptez la création UUID par `uuid_generate_v4()` ou générez côté application.
