// apps/api/src/main.ts
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Server } from "ws";
import { TranscriptionGateway } from "./ws/transcription.gateway";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

async function bootstrap() {
  // 1. Crée l'application NestJS avec CORS restrictif
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000"
  ).split(",");

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  //  Helmet — headers de sécurité HTTP (XSS, clickjacking, MIME sniffing)
  app.use(helmet());

  //  Validation globale des DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non décorées
      forbidNonWhitelisted: true, // Rejette si propriété inconnue
      transform: true, // Transforme les payloads en instances DTO
    }),
  );

  // 2. Lance l'API REST sur port 3001
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(` API REST listening on http://localhost:${port}`);

  // 3. Crée le serveur WebSocket sur port 3003
  const wsPort = process.env.WEBSOCKET_PORT ?? 3003;
  const wss = new Server({ port: Number(wsPort) });

  // Attend que le serveur soit réellement prêt avant d'afficher le message
  wss.on("listening", () => {
    console.log(` WebSocket server ready on ws://localhost:${wsPort}`);
  });

  // Gestion des erreurs de démarrage du serveur
  wss.on("error", (error: any) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        ` Le port ${wsPort} est déjà utilisé. Arrêtez l'autre instance ou changez le port.`,
      );
      process.exit(1);
    } else {
      console.error(" Erreur lors du démarrage du serveur WebSocket:", error);
      process.exit(1);
    }
  });

  // 4. Récupère le TranscriptionGateway depuis le container NestJS
  const gateway = app.get(TranscriptionGateway);

  // 5. Gère les connexions WebSocket
  wss.on("connection", (socket) => {
    console.log("🟢 Client WebSocket connecté");
    gateway.handleConnection(socket as any);

    socket.on("message", (data, isBinary) => {
      // Délègue au gateway
      (gateway as any).handleMessage(socket as any, data as Buffer, !!isBinary);
    });

    socket.on("close", () => {
      console.log(" Client WebSocket déconnecté");
      gateway.handleDisconnect(socket as any);
    });

    socket.on("error", (error) => {
      console.error(" Erreur WebSocket:", error);
    });
  });
}
bootstrap();
