import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

/**
 * Base Gateway with common functionality for all WebSocket gateways
 */
export abstract class BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  protected server: Server;

  protected readonly logger: Logger;

  constructor(gatewayName: string) {
    this.logger = new Logger(gatewayName);
  }

  handleConnection(client: Socket) {
    this.logger.log(`🟢 Client connected: ${client.id}`);
    this.onConnection(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Client disconnected: ${client.id}`);
    this.onDisconnect(client);
  }

  /**
   * Hook called when a client connects
   * Override in child classes for custom behavior
   */
  protected onConnection(client: Socket): void {
    // Default: send connection confirmation
    client.emit("connected", {
      ok: true,
      at: new Date().toISOString(),
      clientId: client.id,
    });
  }

  /**
   * Hook called when a client disconnects
   * Override in child classes for custom cleanup
   */
  protected onDisconnect(client: Socket): void {
    // Override in child classes if needed
  }

  /**
   * Emit event to all connected clients
   */
  protected broadcast(event: string, data: any): void {
    this.logger.debug(`📡 Broadcasting ${event}`);
    this.server.emit(event, data);
  }

  /**
   * Emit event to specific client
   */
  protected emitToClient(client: Socket, event: string, data: any): void {
    this.logger.debug(`📤 Sending ${event} to ${client.id}`);
    client.emit(event, data);
  }

  /**
   * Handle errors in event handlers
   */
  protected handleError(error: Error, context: string): void {
    this.logger.error(`❌ Error in ${context}: ${error.message}`, error.stack);
  }
}
