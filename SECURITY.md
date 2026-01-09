# 🔒 Sécurité - Guide des Clés API

## ✅ Règles de Sécurité

### ❌ NE JAMAIS Commiter

- `.env` - Fichier avec tes vraies clés (déjà dans .gitignore)
- Clés API hardcodées dans le code
- Tokens, mots de passe, secrets

### ✅ À Commiter

- `.env.example` - AVEC placeholders seulement (`your_api_key_here`)
- Code utilisant `process.env.XXX`

---

## 📝 Configuration Actuelle

### Fichiers Sensibles Protégés

```
/.env              → ✅ Dans .gitignore
/.env.local        → ✅ Dans .gitignore
/.env.example      → ⚠️ Supprimé du tracking (ne pas re-add!)
```

### Clés API Requises

```bash
# Groq (LLM)
GROQ_API_KEY=gsk_...

# ElevenLabs (Voice)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...

# Deepgram (STT - optionnel)
DEEPGRAM_API_KEY=...

# Supabase (Database)
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...
```

---

## 🛡️ Checklist Avant Push

```bash
# 1. Vérifier qu'aucune clé n'est dans le code
grep -r "gsk_" apps/
grep -r "sk_[a-zA-Z0-9]{40}" apps/
grep -r "ELEVENLABS_API_KEY\s*=" apps/ --include="*.ts" --include="*.tsx"

# 2. Vérifier .env n'est pas tracké
git status | grep ".env"
# → Ne doit rien retourner

# 3. Vérifier .env.example est propre
cat apps/apip/.env.example
# → Doit contenir "your_api_key_here", PAS de vraies clés
```

---

## 🚨 Si Clé Exposée sur GitHub

### Option 1 : Révoquer + Créer Nouvelle Clé

1. Va sur le service (Groq, ElevenLabs, etc.)
2. Révoque l'ancienne clé
3. Génère nouvelle clé
4. Met à jour ton `.env` local

### Option 2 : Autoriser sur GitHub (Temporaire)

**NON RECOMMANDÉ** - GitHub propose un lien pour autoriser
→ La clé reste exposée publiquement !

---

## 📦 Setup Nouveau Développeur

```bash
# 1. Clone repo
git clone https://github.com/daywon03/Medlink.git
cd Medlink

# 2. Copie .env.example (créé localement, ne pas commit!)
echo "GROQ_API_KEY=your_groq_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_voice_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_key_here" > apps/apip/.env

# 3. Remplace par tes vraies clés
nano apps/apip/.env

# 4. Installe dépendances
cd apps/apip && pnpm install
cd ../web && pnpm install
```

---

## 🔍 Historique Nettoyé

**Commit problématique** : `c049b10e` (contenait vraies clés)
**Action prise** : `git reset --soft HEAD~2` + nouveau commit clean
**Résultat** : ✅ Historique propre, push réussi

---

## 🔑 Où Obtenir les Clés

| Service    | URL                           | Type Gratuit?     |
| ---------- | ----------------------------- | ----------------- |
| Groq       | https://console.groq.com/     | ✅ Oui            |
| ElevenLabs | https://elevenlabs.io/        | ✅ 10k chars/mois |
| Deepgram   | https://console.deepgram.com/ | ✅ $200 crédit    |
| Supabase   | https://supabase.com/         | ✅ 500MB DB       |

---

**Dernière mise à jour** : 2026-01-05
**Status** : ✅ Toutes les clés sécurisées
