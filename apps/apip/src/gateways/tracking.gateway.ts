import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { BaseGateway } from './base.gateway';
import { RideService } from '../services/ride.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { TrackingAssignPayload } from '../types';

/**
 * Tracking Gateway - Handles WebSocket events for public tracking pages (/t/[token])
 * Provides real-time ambulance position updates to citizens
 */
@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
})
export class TrackingGateway extends BaseGateway {
  constructor(
    private readonly rideService: RideService,
    private readonly supabase: SupabaseService
  ) {
    super('TrackingGateway');
  }

  protected onConnection(client: Socket): void {
    super.onConnection(client);
    this.logger.log(`👁️ Tracking client connected: ${client.id}`);
  }

  /**
   * Handle tracking request from citizen
   * Returns the current state of their ride
   */
  @SubscribeMessage('tracking:request')
  handleTrackingRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { token: string },
  ): void {
    try {
      this.logger.log(`🔍 Tracking request from client for token: ${payload?.token}`);

      if (!payload?.token) {
        this.emitToClient(client, 'tracking:error', {
          error: 'Token is required',
        });
        return;
      }

      // Find the ride in our service
      const ride = this.rideService.findByToken(payload.token);

      if (!ride) {
        this.logger.warn(`⚠️ Ride not found for token: ${payload.token}`);
        this.emitToClient(client, 'tracking:error', {
          error: 'Ride not found or expired',
          token: payload.token,
        });
        return;
      }

      // Check if expired
      if (new Date(ride.expiresAt).getTime() < Date.now()) {
        this.logger.warn(`⏰ Ride expired for token: ${payload.token}`);
        this.emitToClient(client, 'tracking:error', {
          error: 'Ride has expired',
          token: payload.token,
        });
        return;
      }

      // Send current ride state to the client
      this.emitToClient(client, 'tracking:assign', ride);
      this.logger.log(`✅ Sent tracking data for token: ${payload.token}`);
    } catch (error) {
      this.handleError(error as Error, 'handleTrackingRequest');
      this.emitToClient(client, 'tracking:error', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle tracking assignment from ARM
   * Creates or updates a ride and broadcasts to tracking clients
   */
  @SubscribeMessage('tracking:assign')
  async handleTrackingAssign(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TrackingAssignPayload,
  ): Promise<void> {
    try {
      this.logger.log(`🚑 Tracking assignment for token: ${payload.token}`);

      // Validate payload
      if (!payload.token) {
        this.emitToClient(client, 'tracking:error', {
          error: 'Token is required',
        });
        return;
      }

      // Create the ride object
      const ride = {
        token: payload.token,
        status: payload.status || 'assigned',
        ambulance: payload.ambulance || { label: 'AMB-?' },
        // ✅ Récupérer hôpital depuis BDD au lieu de hardcodé
        destinationHospital: payload.destinationHospital || await this.getHospitalFromDB(payload.token),
        incident: payload.incident || { label: '—', lat: 0, lng: 0 },
        ambulancePos: payload.ambulancePos || {
          lat: payload.incident?.lat || 0,
          lng: payload.incident?.lng || 0,
          updatedAt: new Date().toISOString(),
        },
        // ✅ Récupérer ETA depuis BDD
        etaMinutes: payload.etaMinutes || await this.getETAFromDB(payload.token),
        expiresAt: payload.expiresAt || new Date(Date.now() + 30 * 60000).toISOString(),
      };

      // Store in service
      this.rideService.upsertRide(ride);

      // Broadcast to all tracking clients watching this token
      this.broadcast('tracking:assign', ride);

      // Acknowledge to sender
      this.emitToClient(client, 'tracking:assign:ack', {
        success: true,
        token: payload.token,
      });

      this.logger.log(`✅ Tracking assignment broadcast for token: ${payload.token}`);
    } catch (error) {
      this.handleError(error as Error, 'handleTrackingAssign');
      this.emitToClient(client, 'tracking:error', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle ride updates (position, status, ETA)
   */
  @SubscribeMessage('ride:update')
  handleRideUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ): void {
    try {
      this.logger.log(`📍 Ride update for token: ${payload.token}`);

      if (!payload.token) {
        this.emitToClient(client, 'tracking:error', {
          error: 'Token is required',
        });
        return;
      }

      // Update in service based on what's provided
      if (payload.ambulancePos) {
        this.rideService.updateAmbulancePosition(
          payload.token,
          payload.ambulancePos.lat,
          payload.ambulancePos.lng,
          payload.etaMinutes,
        );
      }

      if (payload.status) {
        this.rideService.updateStatus(payload.token, payload.status);
      }

      // Broadcast update to all clients
      this.broadcast('ride:update', payload);

      this.logger.log(`✅ Ride update broadcast for token: ${payload.token}`);
    } catch (error) {
      this.handleError(error as Error, 'handleRideUpdate');
      this.emitToClient(client, 'tracking:error', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 🆕 Récupérer hôpital depuis BDD
   */
  private async getHospitalFromDB(callId: string) {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('triage_reports')
        .select('nearest_hospital_data')
        .eq('call_id', callId)
        .single();

      if (!error && data?.nearest_hospital_data) {
        const hospital = data.nearest_hospital_data;
        this.logger.log(`🏥 Hôpital BDD: ${hospital.name}`);
        return {
          name: hospital.name,
          address: hospital.address,
          lat: hospital.lat,
          lng: hospital.lng
        };
      }
    } catch (error) {
      this.logger.warn(`Could not fetch hospital from DB: ${error.message}`);
    }

    // Fallback
    return {
      name: 'Hôpital le plus proche',
      address: 'En cours de localisation',
      lat: 48.8566,
      lng: 2.3522
    };
  }

  /**
   * 🆕 Récupérer ETA depuis BDD
   */
  private async getETAFromDB(callId: string): Promise<number | undefined> {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('triage_reports')
        .select('estimated_arrival_minutes')
        .eq('call_id', callId)
        .single();

      if (!error && data?.estimated_arrival_minutes) {
        this.logger.log(`⏱️ ETA BDD: ${data.estimated_arrival_minutes}min`);
        return data.estimated_arrival_minutes;
      }
    } catch (error) {
      this.logger.warn(`Could not fetch ETA from DB: ${error.message}`);
    }

    return undefined;
  }
}
