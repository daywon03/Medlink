import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Socket } from "socket.io";
import { BaseGateway } from "./base.gateway";
import type { ArmActionPayload } from "../types";
import { RedisService } from "../services/redis.service";
import { SupabaseAssignmentRepository } from "../infrastructure/repositories/supabase-assignment.repository";

/**
 * ARM Gateway - Handles WebSocket events for the ARM console (/arm)
 * Manages incidents, ambulance assignments, and operator actions
 */
@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  },
})
export class ArmGateway extends BaseGateway {
  constructor(
    private readonly redis: RedisService,
    private readonly assignmentRepo: SupabaseAssignmentRepository
  ) {
    super("ArmGateway");

    // 👂 Subscribe to Redis arm:updates channel
    this.redis.subscribe("arm:updates", (data: any) => {
      this.logger.log(`📡 Received from Redis: ${data.callId}`);

      // 📡 Broadcast to ALL ARM dashboard clients via Socket.IO
      this.broadcast("call:update", data);

      this.logger.log(`✅ Broadcasted to ARM dashboards: ${data.callId}`);
    });

    // 🆕 Subscribe to Redis arm:geolocation channel (async background search results)
    this.redis.subscribe("arm:geolocation", (data: any) => {
      this.logger.log(`📍 Geolocation received from Redis: ${data.callId}`);

      // 📡 Broadcast geolocation update to ARM dashboards
      this.broadcast("call:geolocation", data);

      this.logger.log(
        `✅ Geolocation broadcasted: ${data.nearestHospital?.name || "No hospital"}`,
      );
    });

    // 🆕 Subscribe to Redis arm:extraction channel (AI structured data extraction)
    this.redis.subscribe("arm:extraction", (data: any) => {
      this.logger.log(`🤖 Extraction received from Redis: ${data.callId}`);
      this.broadcast("call:extraction", data);
      this.logger.log(
        `✅ Extraction broadcasted: Age=${data.extractedData?.patientAge}, Symptoms=[${data.extractedData?.symptoms?.join(', ') || ''}]`,
      );
    });

    this.logger.log(
      "✅ ArmGateway subscribed to Redis arm:updates + arm:geolocation + arm:extraction channels",
    );
  }

  protected onConnection(client: Socket): void {
    super.onConnection(client);
    // Send ARM-specific connection event
    this.emitToClient(client, "arm:connected", {
      ok: true,
      at: new Date().toISOString(),
    });
  }

  /**
   * Handle ARM operator actions (assign ambulance, edit incident, notify citizen)
   */
  @SubscribeMessage("arm:action")
  async handleArmAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ArmActionPayload,
  ): Promise<void> {
    try {
      this.logger.log(`📋 ARM action received: ${payload.type}`);

      // ✅ Persist assignment using SupabaseAssignmentRepository (Clean Architecture)
      if (payload.type === 'assign_ambulance') {
        const p = payload as any;
        const callId = p.incidentId || p.callId;
        const ambulanceTeam = p.team || p.ambulanceTeam;
        if (callId && ambulanceTeam) {
          await this.assignmentRepo.assignAmbulance({
            callId,
            ambulanceTeam,
            trackingToken: p.trackingToken || callId,
          });
          this.logger.log(`✅ Assignment persisted: ${ambulanceTeam} → ${callId}`);
        }
      }

      // Broadcast the incident update to all connected clients (including other ARM operators)
      this.broadcast("incident:update", {
        type: "action",
        payload,
        at: new Date().toISOString(),
      });

      // Acknowledge back to the sender
      this.emitToClient(client, "arm:action:ack", {
        success: true,
        type: payload.type,
      });
    } catch (error) {
      this.handleError(error as Error, "handleArmAction");
      this.emitToClient(client, "arm:action:error", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle tracking request from ARM console
   * This is called when ARM wants to get current state for a specific incident
   */
  @SubscribeMessage("tracking:request")
  handleTrackingRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { token: string },
  ): void {
    try {
      this.logger.log(`🔍 Tracking request for token: ${payload.token}`);

      // Emit back to the requesting client
      // The actual data will be provided by TrackingGateway
      this.emitToClient(client, "tracking:request:received", {
        token: payload.token,
      });
    } catch (error) {
      this.handleError(error as Error, "handleTrackingRequest");
    }
  }

  /**
   * Broadcast tracking assignment to all clients
   * Called when an ambulance is assigned from ARM console
   */
  broadcastTrackingAssignment(data: any): void {
    this.logger.log(`📡 Broadcasting tracking assignment: ${data.token}`);
    this.broadcast("tracking:assign", data);
  }
}
