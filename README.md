# 🏥 Medlink - Système Intelligent de Gestion d'Urgences Médicales

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)

Medlink est une plateforme intelligente de gestion d'urgences médicales utilisant l'IA conversationnelle pour assister les agents de régulation médicale (ARM) dans la collecte d'informations critiques lors d'appels d'urgence.

---

## 📋 Table des Matières

- [Aperçu](#-aperçu)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Technologies](#-technologies)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Démarrage](#-démarrage)
- [Structure du Projet](#-structure-du-projet)
- [API et Endpoints](#-api-et-endpoints)
- [Développement](#-développement)
- [Déploiement](#-déploiement)
- [Contribuer](#-contribuer)

---

## 🎯 Aperçu

Medlink est composé de trois modules principaux :

1. **Web App (Next.js)** - Interface utilisateur pour les agents ARM et les hôpitaux
2. **API Backend (NestJS)** - Serveur REST, WebSocket et gestion temps réel
3. **Agent ARM IA (Groq + ElevenLabs)** - Assistant conversationnel intelligent

L'agent IA utilise :
- **Groq** (Llama 3.3 70B) pour la compréhension du langage naturel
- **ElevenLabs** pour la transcription vocale (STT) et la synthèse vocale (TTS)
- Un système de **contexte conversationnel** pour des réponses intelligentes et adaptées

---

## ✨ Fonctionnalités

### 🤖 Agent ARM Intelligent
- ✅ Compréhension contextuelle avancée (ne pose jamais de questions redondantes)
- ✅ Adaptation automatique selon le contexte (patient vs témoin)
- ✅ Priorisation intelligente des questions (adresse, gravité, conscience)
- ✅ Transcription vocale en temps réel (français)
- ✅ Synthèse vocale naturelle

### 💬 Communication Temps Réel
- ✅ WebSocket bidirectionnel pour audio streaming
- ✅ Reconnexion automatique en cas de déconnexion
- ✅ Conversion audio WebM → PCM 16kHz pour transcription

### 📊 Gestion des Appels
- ✅ Création automatique de profil citoyen anonyme
- ✅ Stockage des transcriptions dans Supabase
- ✅ Extraction automatique d'adresse
- ✅ Historique complet des conversations

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │  ← Interface utilisateur web
│   Port: 3000    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │
│   (NestJS)      │  ← API REST + WebSocket
│   Port: 3001    │
│   WS: 3002      │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   Groq AI   │   │ ElevenLabs  │
│   (LLM)     │   │   (STT/TTS) │
└─────────────┘   └─────────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │  ← Base de données
│   (PostgreSQL)  │
└─────────────────┘
```

### Flow d'un Appel

```
1. Utilisateur → Ouvre page /voice (Next.js)
2. Frontend → Connecte WebSocket au backend (port 3002)
3. Frontend → Envoie audio microphone (WebM)
4. Backend → Convertit WebM → PCM 16kHz (ffmpeg)
5. Backend → Envoie PCM à ElevenLabs pour transcription
6. ElevenLabs → Retourne transcription texte
7. Backend → Envoie transcription à Groq (Llama 3.3)
8. Groq → Génère réponse contextuelle
9. Backend → Synthèse vocale via ElevenLabs TTS
10. Frontend → Joue audio de l'agent + affiche transcription
```

---

## 🛠️ Technologies

### Frontend
- **Next.js 15** - Framework React avec App Router
- **React 19** - Bibliothèque UI
- **TypeScript** - Typage statique
- **WebSocket API** - Communication temps réel

### Backend
- **NestJS 10** - Framework Node.js progressif
- **WebSocket (ws)** - Serveur WebSocket natif
- **Groq SDK** - API pour Llama 3.3 70B
- **ElevenLabs API** - STT/TTS en temps réel
- **Supabase Client** - Client PostgreSQL
- **FFmpeg** - Conversion audio

### Base de Données
- **Supabase (PostgreSQL)** - Stockage des appels et transcriptions

### IA & ML
- **Llama 3.3 70B Versatile** (via Groq) - Modèle de langage
- **ElevenLabs Scribe v2** - Speech-to-Text
- **ElevenLabs Multilingual v2** - Text-to-Speech

---

## 📦 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** `>= 20.0.0` - [Télécharger](https://nodejs.org/)
- **pnpm** `>= 10.7.0` - [Installer](https://pnpm.io/installation)
  ```bash
  npm install -g pnpm@10.7.0
  ```
- **FFmpeg** - Pour la conversion audio
  ```bash
  # macOS
  brew install ffmpeg
  
  # Linux (Ubuntu/Debian)
  sudo apt-get install ffmpeg
  
  # Windows (Chocolatey)
  choco install ffmpeg
  ```

### Clés API Requises

Vous aurez besoin de créer des comptes (gratuits) pour obtenir les clés suivantes :

1. **Groq API Key** - [console.groq.com](https://console.groq.com/)
2. **ElevenLabs API Key** - [elevenlabs.io](https://elevenlabs.io/)
3. **Supabase Project** - [supabase.com](https://supabase.com/)

---

## 🚀 Installation

### 1. Cloner le Projet

```bash
git clone https://github.com/votre-username/Medlink.git
cd Medlink
```

### 2. Installer les Dépendances

```bash
# Installer toutes les dépendances (monorepo)
pnpm install
```

Cette commande installera automatiquement les dépendances pour :
- `/apps/web` (Frontend Next.js)
- `/apps/apip` (Backend NestJS)

---

## ⚙️ Configuration

### 1. Configuration Backend (API)

Créez un fichier `.env` dans `/apps/apip/` :

```bash
cd apps/apip
touch .env
```

Ajoutez les variables suivantes :

```env
# API Configuration
PORT=3001
WS_PORT=3002

# Groq API (LLM)
GROQ_API_KEY=gsk_votre_cle_groq_ici

# ElevenLabs API (STT/TTS)
ELEVENLABS_API_KEY=votre_cle_elevenlabs_ici

# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_KEY=votre_anon_key_supabase_ici
```

### 2. Configuration Frontend (Web)

Créez un fichier `.env.local` dans `/apps/web/` :

```bash
cd apps/web
touch .env.local
```

Ajoutez les variables suivantes :

```env
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Supabase (Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key_supabase_ici
```

### 3. Configuration Supabase

Créez les tables suivantes dans votre projet Supabase :

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

## 🎬 Démarrage

### Développement (Mode Watch)

#### Option 1 : Démarrer tout en parallèle (recommandé)

Ouvrez **2 terminaux** :

**Terminal 1 - Backend** :
```bash
cd apps/apip
pnpm run start:dev
```
✅ Backend lancé sur `http://localhost:3001`  
✅ WebSocket sur `ws://localhost:3002`

**Terminal 2 - Frontend** :
```bash
cd apps/web
pnpm run dev
```
✅ Frontend lancé sur `http://localhost:3000`

#### Option 2 : Commandes depuis la racine

```bash
# Backend
pnpm dev:api

# Frontend (dans un autre terminal)
pnpm dev:web
```

### Production

```bash
# Build
pnpm run build

# Start
cd apps/web && pnpm start
cd apps/apip && pnpm run start:prod
```

---

## 🗂️ Structure du Projet

```
Medlink/
├── apps/
│   ├── web/                    # Frontend Next.js
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx           # Page d'accueil
│   │   │   │   └── voice/
│   │   │   │       └── page.tsx       # Interface voix ARM
│   │   │   └── components/
│   │   ├── package.json
│   │   └── .env.local
│   │
│   └── apip/                   # Backend NestJS
│       ├── src/
│       │   ├── main.ts                # Point d'entrée
│       │   ├── app.module.ts          # Module principal
│       │   ├── ws/
│       │   │   └── transcription.gateway.ts    # WebSocket Gateway
│       │   ├── eliza/
│       │   │   ├── eliza-arm.service.ts        # Service Groq AI
│       │   │   └── arm-character.json          # Personality config
│       │   ├── elevenlabs/
│       │   │   ├── elevenlabs-realtime.service.ts  # STT Service
│       │   │   └── elevenlabs-tts.service.ts       # TTS Service
│       │   └── supabase/
│       │       └── supabase.service.ts         # Database service
│       ├── package.json
│       └── .env
│
├── deploy/                     # Docker & Deployment
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
│
├── package.json               # Root workspace config
├── pnpm-lock.yaml
└── README.md
```

---

## 🔌 API et Endpoints

### WebSocket Events (Port 3002)

#### Client → Server

**`start_call`** - Démarrer un nouvel appel
```json
{
  "type": "start_call"
}
```

**Audio Chunk** - Envoyer audio (binary WebM)
```javascript
// Binary data (WebM audio)
websocket.send(audioBlob);
```

**`end_call`** - Terminer l'appel
```json
{
  "type": "end_call"
}
```

#### Server → Client

**`agent_speech`** - Réponse de l'agent
```json
{
  "type": "agent_speech",
  "payload": {
    "text": "Quelle est votre adresse exacte ?",
    "audio": "base64_encoded_audio"
  }
}
```

**`patient_speech`** - Transcription patient
```json
{
  "type": "patient_speech",
  "payload": {
    "text": "J'ai mal au pied"
  }
}
```

**`info`** - Messages d'info
```json
{
  "type": "info",
  "payload": {
    "message": "Appel terminé."
  }
}
```

### REST API (Port 3001)

**`GET /`** - Health check
```bash
curl http://localhost:3001
```

---

## 🧪 Développement

### Tester l'Agent IA en CLI

Le backend inclut un testeur CLI pour Groq :

```bash
cd apps/apip
pnpm run test:groq
```

Cela lance une interface CLI interactive pour tester l'agent ARM sans le frontend.

### Logs Backend

Les logs incluent :
- 🟢 Connexions/déconnexions WebSocket
- 👤 Transcriptions patients
- 🤖 Réponses agent
- 🌐 Appels Groq API
- 🎵 Conversions audio

### Debugging

```bash
# Backend avec debug
cd apps/apip
pnpm run start:debug

# Frontend avec logs
cd apps/web
pnpm run dev
```

### Linting

```bash
# Linter backend
cd apps/apip
pnpm run lint

# Linter frontend
cd apps/web
pnpm run lint
```

---

## 🐳 Déploiement

### Docker Compose (Développement)

```bash
# Démarrer tous les services
pnpm run docker:up

# Arrêter
pnpm run docker:down
```

### Docker Compose (Production)

```bash
docker compose -f deploy/docker-compose.prod.yml up -d
```

### Variables d'Environnement Production

Assurez-vous de configurer :
- `NODE_ENV=production`
- Clés API sécurisées
- HTTPS activé
- CORS configuré correctement

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Voici comment contribuer :

1. **Fork** le projet
2. Créez une **branche feature** (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une **Pull Request**

### Guidelines

- Utilisez TypeScript strict mode
- Suivez les conventions ESLint
- Ajoutez des tests si applicable
- Documentez les nouvelles fonctionnalités

---

## 📝 License

Ce projet est sous licence **ISC**.

---

## 👥 Équipe

Développé dans le cadre du projet SAE BUT3.

---

## 🆘 Support

Pour toute question ou problème :

1. Consultez la [documentation](#)
2. Ouvrez une [issue](https://github.com/votre-username/Medlink/issues)
3. Contactez l'équipe

---

## 🎓 Ressources

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation NestJS](https://docs.nestjs.com/)
- [Groq API Docs](https://console.groq.com/docs)
- [ElevenLabs API Docs](https://elevenlabs.io/docs)
- [Supabase Docs](https://supabase.com/docs)

---

<div align="center">

**Fait avec ❤️ pour sauver des vies**

[⬆ Retour en haut](#-medlink---système-intelligent-de-gestion-durgences-médicales)

</div>
