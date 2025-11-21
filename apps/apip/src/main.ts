// apps/api/src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server } from 'ws';
import { TranscriptionGateway } from './ws/transcription.gateway';

async function bootstrap() {
  // 1. Crée l'application NestJS
  const app = await NestFactory.create(AppModule, { cors: true });
  
  // 2. Lance l'API REST sur port 3001
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`✅ API REST listening on http://localhost:${port}`);

  // 3. Crée le serveur WebSocket sur port 3002
  const wsPort = process.env.WEBSOCKET_PORT ?? 3002;
  const wss = new Server({ port: Number(wsPort) });
  console.log(`✅ WebSocket server ready on ws://localhost:${wsPort}`);

  // 4. Récupère le TranscriptionGateway depuis le container NestJS
  const gateway = app.get(TranscriptionGateway);

  // 5. Gère les connexions WebSocket
  wss.on('connection', (socket) => {
    console.log('🟢 Client WebSocket connecté');
    gateway.handleConnection(socket as any);

    socket.on('message', (data, isBinary) => {
      // Délègue au gateway
      (gateway as any).handleMessage(socket as any, data as Buffer, !!isBinary);
    });

    socket.on('close', () => {
      console.log('🔴 Client WebSocket déconnecté');
      gateway.handleDisconnect(socket as any);
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
    });
  });
}
bootstrap();
