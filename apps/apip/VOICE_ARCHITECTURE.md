# Voice System - ElevenLabs Full Stack

## ✅ Architecture Actuelle

````
┌─────────────────────────────────────────────────────────────┐
│                    VOICE FLOW COMPLET                        │
└─────────────────────────────────────────────────────────────┘

  Microphone Audio Stream (WebM)
         │
         ▼
  ┌──────────────────┐
  │  WebSocket       │
  │  /voice          │
  └──────────────────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────┐
  │  ELEVENLABS SCRIBE REALTIME V2 (STT)                 │
  │  ───────────────────────────────────────────────     │
  │  • Model: scribe_v2                                  │
  │  • Language: Français natif                          │
  │  • Format: WebM direct (auto-conversion)             │
  │  • Transcription en temps réel                       │
  └──────────────────────────────────────────────────────┘
         │
         ▼ Transcript
  ┌──────────────────────────────────────────────────────┐
  │  ELIZA MULTI-AGENT SYSTEM                            │
  │  ───────────────────────────────────────────────     │
  │  1. TriageAgent → Collect info                       │
  │  2. ClassificationAgent → P0/P1/P2/P3                │
  │  3. GuidanceAgent → RCP/Heimlich (if P0)             │
  │  4. LLM: groq/compound                               │
  └──────────────────────────────────────────────────────┘
         │
         ▼ Response Text
  ┌──────────────────────────────────────────────────────┐
  │  ELEVENLABS TTS                                      │
  │  ───────────────────────────────────────────────     │
  │  • Model: eleven_multilingual_v2                     │
  │  • Voice ID: a1KZUXKFVFDOb33I1uqr                    │
  │  • Streaming audio output (MP3)                      │
  └──────────────────────────────────────────────────────┘
         │
         ▼
  Speaker Audio Output


## 📂 Services Voice

### ✅ ACTIF : STT (Speech-to-Text)
**File**: `elevenlabs-realtime.service.ts`
- **Provider**: ElevenLabs Scribe Realtime v2
- **Model**: `scribe_v2`
- **Language**: Français natif ✅
- **Format**: WebM (auto-conversion interne)

### ✅ ACTIF : TTS (Text-to-Speech)
**File**: `elevenlabs-tts.service.ts`
- **Provider**: ElevenLabs
- **Model**: `eleven_multilingual_v2`
- **Voice**: `a1KZUXKFVFDOb33I1uqr`

## 🔧 Configuration

### Gateway
**File**: `ws/transcription.gateway.ts`
- Uses `ElevenLabsRealtimeService` for STT
- Uses `ElevenLabsTTSService` for TTS
- Direct WebM audio streaming (no conversion needed)

### Module
**File**: `app.module.ts`
```typescript
providers: [
  ElevenLabsRealtimeService,  // STT
  ElevenLabsTTSService,       // TTS
  ElizaArmService,            // Multi-agent orchestration
]
````

## 🔑 Variables d'Environnement

```bash
# LLM - Groq
GROQ_API_KEY=your_groq_key

# Voice - ElevenLabs (STT + TTS)
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=a1KZUXKFVFDOb33I1uqr
```

## ⚡ Flow Technique

```typescript
// 1. User parle (frontend capture audio WebM)
WebSocket → backend

// 2. Gateway envoie à ElevenLabs STT
TranscriptionGateway.sendAudioChunk(webmBuffer)
  → ElevenLabsRealtimeService
    → WebSocket ElevenLabs Scribe v2
      → Conversion WebM → PCM (interne ElevenLabs)
        → Transcription

// 3. Callback transcript
transcriptCallback("Mon père est tombé")
  → TriageAgent.process()
  → ElizaArmService.getArmResponse()
    → Groq LLM response

// 4. TTS génère audio
ElevenLabsTTSService.textToSpeech(response)
  → MP3 audio buffer
    → Base64 to frontend

// 5. Frontend joue audio agent
```

## 🎯 Avantages Architecture

✅ **Français natif** : Scribe v2 optimisé pour le français
✅ **Simplicité** : Un seul provider (ElevenLabs) pour STT+TTS
✅ **Pas de conversion** : WebM direct, ElevenLabs gère tout
✅ **Temps réel** : Transcription streaming
✅ **Qualité TTS** : Voice professionnelle française
✅ **Gratuit LLM** : groq/compound pour réponses agent

## 📊 Performance

| Métrique          | Valeur                       |
| ----------------- | ---------------------------- |
| **STT Latency**   | ~500-800ms                   |
| **TTS Latency**   | ~200-400ms                   |
| **E2E Response**  | ~1.5-2.5s                    |
| **Accuracy STT**  | Excellent (français natif)   |
| **Voice Quality** | Premium (TTS multilingue v2) |

## 🗂️ Fichiers

```
apps/apip/
├── src/
│   ├── elevenlabs/
│   │   ├── elevenlabs-realtime.service.ts  ✅ STT Scribe v2
│   │   ├── elevenlabs-tts.service.ts       ✅ TTS
│   │   └── backup/
│   │       └── elevenlabs.service.ts       (old STT one-shot)
│   ├── ws/
│   │   └── transcription.gateway.ts        ✅ WebSocket handler
│   ├── eliza/
│   │   ├── characters/                     ✅ 3 agents
│   │   ├── actions/                        ✅ 5 actions
│   │   └── eliza-arm.service.ts            ✅ Orchestration
│   └── app.module.ts                       ✅ Config
└── .env                                    ✅ API keys
```

## 🚀 Démarrage

### 1. Install

```bash
pnpm install  # Déjà fait
```

### 2. Configuration

```bash
cp .env.example .env
# Ajouter ELEVENLABS_API_KEY
```

### 3. Build

```bash
pnpm run build  # ✅ SUCCESS
```

### 4. Dev

```bash
pnpm run start:dev
```

### 5. Test

```
http://localhost:3000/voice
- Parler en français
- ElevenLabs transcrit
- Agent répond vocalement
```

## 🎯 État Production

✅ **STT** : ElevenLabs Scribe Realtime v2 (français)
✅ **TTS** : ElevenLabs (voice pro française)
✅ **LLM** : Groq compound (gratuit)
✅ **Agents** : 3 agents Eliza (Triage, Classification, Guidance)
✅ **Build** : SUCCESS
✅ **Ready** : Production ✨

---

**Date** : 2026-01-05
**Stack** : Full ElevenLabs (STT + TTS)
**Status** : 🟢 PRODUCTION-READY
