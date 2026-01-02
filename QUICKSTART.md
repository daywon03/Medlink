# 🚀 Guide de Démarrage Rapide - Medlink

Ce guide vous permettra de lancer Medlink en moins de 10 minutes.

---

## ⚡ Installation Express (TL;DR)

```bash
# 1. Cloner et installer
git clone https://github.com/votre-username/Medlink.git
cd Medlink
pnpm install

# 2. Configurer les variables d'environnement
cp apps/apip/.env.example apps/apip/.env
cp apps/web/.env.example apps/web/.env.local
# ⚠️ Éditer ces fichiers avec vos vraies clés API

# 3. Lancer (2 terminaux)
# Terminal 1:
cd apps/apip && pnpm run start:dev

# Terminal 2:
cd apps/web && pnpm run dev

# 4. Ouvrir http://localhost:3000/voice
```

---

## 📋 Prérequis

### 1. Installer les Outils

```bash
# Node.js (>= 20.0.0)
node -v  # Vérifier la version

# pnpm (>= 10.7.0)
npm install -g pnpm@10.7.0

# FFmpeg (pour conversion audio)
# macOS:
brew install ffmpeg

# Linux (Ubuntu/Debian):
sudo apt-get install ffmpeg

# Windows (Chocolatey):
choco install ffmpeg
```

### 2. Obtenir les Clés API (Gratuit)

#### Groq (LLM)
1. Aller sur [console.groq.com](https://console.groq.com/)
2. Créer un compte
3. Aller dans "API Keys"
4. Créer une nouvelle clé → Copier `gsk_...`

#### ElevenLabs (STT/TTS)
1. Aller sur [elevenlabs.io](https://elevenlabs.io/)
2. Créer un compte
3. Aller dans "Profile" → "API Keys"
4. Copier votre clé

#### Supabase (Database)
1. Aller sur [supabase.com](https://supabase.com/)
2. Créer un nouveau projet
3. Aller dans "Settings" → "API"
4. Copier `Project URL` et `anon/public key`

5. **Créer les tables** dans "SQL Editor" :
```sql
-- Table citizens
CREATE TABLE citizens (
  citizen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table calls
CREATE TABLE calls (
  call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(citizen_id),
  location_input_text TEXT,
  extracted_address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);

-- Table transcriptions
CREATE TABLE transcriptions (
  transcription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(call_id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ⚙️ Configuration Détaillée

### Backend (`apps/apip/.env`)

```bash
# Copier le template
cd Medlink/apps/apip
cp .env.example .env

# Éditer avec vos vraies clés
nano .env  # ou code .env
```

**Contenu de `.env`** :
```env
PORT=3001
WS_PORT=3002

# Remplacer par vos vraies clés:
GROQ_API_KEY=gsk_votre_vraie_cle_groq_ici
ELEVENLABS_API_KEY=votre_vraie_cle_elevenlabs_ici
SUPABASE_URL=https://votre-vrai-projet.supabase.co
SUPABASE_KEY=votre_vraie_anon_key_supabase_ici
```

### Frontend (`apps/web/.env.local`)

```bash
# Copier le template
cd Medlink/apps/web
cp .env.example .env.local

# Éditer
nano .env.local  # ou code .env.local
```

**Contenu de `.env.local`** :
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=https://votre-vrai-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_vraie_anon_key_supabase_ici
```

---

## 🎬 Lancement

### Option 1 : Deux Terminaux (Recommandé)

**Terminal 1 - Backend** :
```bash
cd Medlink/apps/apip
pnpm run start:dev
```

Vous devriez voir :
```
✅ API REST listening on http://localhost:3001
✅ WebSocket server ready on ws://localhost:3002
[ElizaArmService] ✅ ARM Service initialized
[ElizaArmService] 🔑 Groq API Key: ✅ SET
```

**Terminal 2 - Frontend** :
```bash
cd Medlink/apps/web
pnpm run dev
```

Vous devriez voir :
```
▲ Next.js 15.5.4
- Local:        http://localhost:3000
```

### Option 2 : Depuis la Racine

```bash
# Backend (un terminal)
cd Medlink
pnpm dev:api

# Frontend (autre terminal)
pnpm dev:web
```

---

## ✅ Vérification

### 1. Backend Fonctionne

```bash
# Test health check
curl http://localhost:3001

# Devrait retourner: "Hello World!" ou similaire
```

### 2. Frontend Accessible

Ouvrir dans le navigateur :
- **Page d'accueil** : [http://localhost:3000](http://localhost:3000)
- **Interface voix** : [http://localhost:3000/voice](http://localhost:3000/voice)

### 3. Test Complet

1. Aller sur [http://localhost:3000/voice](http://localhost:3000/voice)
2. Cliquer sur **"Démarrer l'appel"**
3. Autoriser le microphone
4. Parler : *"Bonjour"*
5. L'agent devrait répondre : *"Bonjour, vous êtes bien au service d'aide médicale urgente. Quelle est votre urgence ?"*

---

## 🐛 Dépannage

### Erreur : `EADDRINUSE: address already in use :::3001`

Un processus utilise déjà le port 3001 :
```bash
# Tuer le processus
lsof -ti:3001 | xargs kill -9
```

### Erreur : `GROQ_API_KEY not found`

Vous avez oublié de créer le fichier `.env` :
```bash
cd apps/apip
cp .env.example .env
# Puis éditer .env avec vos vraies clés
```

### Erreur : `ffmpeg not found`

FFmpeg n'est pas installé :
```bash
# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

### WebSocket : Connection refused

Le backend n'est pas lancé ou utilise un autre port :
1. Vérifier que le backend tourne : `curl http://localhost:3001`
2. Vérifier les ports dans `.env` (backend) et `.env.local` (frontend)

### L'agent ne répond pas

1. **Vérifier les logs backend** : Vous devriez voir `[ElizaArmService] 🌐 Calling Groq API`
2. **Vérifier votre clé Groq** : Tester avec `cd apps/apip && pnpm run test:groq`
3. **Vérifier votre clé ElevenLabs** : Les logs doivent montrer `✅ Committed audio chunk`

### Pas de transcription audio

1. **Microphone autorisé ?** Vérifier les permissions du navigateur
2. **Format audio ?** Vérifier les logs backend : `Converted WebM(...b) → PCM(...b)`
3. **ElevenLabs connecté ?** Chercher : `🔗 ElevenLabs Realtime connected`

---

## 📚 Prochaines Étapes

Une fois que tout fonctionne :

1. Lire le [README principal](../README.md) pour la documentation complète
2. Explorer [l'architecture](../README.md#-architecture) du projet
3. Personnaliser [le prompt de l'agent](../apps/apip/src/eliza/eliza-arm.service.ts)
4. Consulter [l'API WebSocket](../README.md#-api-et-endpoints)

---

## 🆘 Besoin d'Aide ?

- **Documentation complète** : [README.md](../README.md)
- **Issues GitHub** : [Ouvrir une issue](https://github.com/votre-username/Medlink/issues)
- **Logs détaillés** : Backend en mode debug : `cd apps/apip && pnpm run start:debug`

---

**Bon développement ! 🚀**
