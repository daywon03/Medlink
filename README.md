# Medlink
SaeMedlink

medlink/
├─ apps/
│  ├─ web/      # Next.js (ARM/Hôpital/PWA)
│  ├─ api/      # NestJS (REST + Socket.IO + WSS)
│  └─ eliza/    # Eliza OS (agent TRIAGE + RAG)
├─ packages/
│  ├─ shared/   # types, utils
│  └─ config/   # eslint, tsconfig, zod schemas
├─ deploy/
│  ├─ docker-compose.dev.yml
│  ├─ docker-compose.prod.yml
│  └─ scripts/deploy.sh
├─ docker/
│  ├─ web.Dockerfile
│  ├─ api.Dockerfile
│  └─ eliza.Dockerfile
├─ .gitignore
├─ .editorconfig
└─ README.md
