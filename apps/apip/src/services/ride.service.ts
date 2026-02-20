import { Injectable, Logger } from "@nestjs/common";
import { PublicRide } from "../types";

/**
 * Service to manage ride tracking data in memory
 * In production, this should be replaced with a database
 */
@Injectable()
export class RideService {
  private readonly logger = new Logger(RideService.name);
  private readonly rides: Map<string, PublicRide> = new Map();

  /**
   * Create or update a ride
   */
  upsertRide(ride: PublicRide): void {
    this.rides.set(ride.token, ride);
    this.logger.log(` Ride upserted: ${ride.token}`);
  }

  /**
   * Get a ride by token
   */
  findByToken(token: string): PublicRide | undefined {
    return this.rides.get(token);
  }

  /**
   * Update ride status
   */
  updateStatus(token: string, status: PublicRide["status"]): boolean {
    const ride = this.rides.get(token);
    if (!ride) return false;

    ride.status = status;
    this.rides.set(token, ride);
    this.logger.log(` Ride ${token} status updated to: ${status}`);
    return true;
  }

  /**
   * Update ambulance position
   */
  updateAmbulancePosition(
    token: string,
    lat: number,
    lng: number,
    etaMinutes?: number,
  ): boolean {
    const ride = this.rides.get(token);
    if (!ride) return false;

    ride.ambulancePos = {
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    };

    if (etaMinutes !== undefined) {
      ride.etaMinutes = etaMinutes;
    }

    this.rides.set(token, ride);
    this.logger.log(` Ride ${token} position updated: ${lat}, ${lng}`);
    return true;
  }

  /**
   * Delete a ride (when expired or completed)
   */
  deleteRide(token: string): boolean {
    const deleted = this.rides.delete(token);
    if (deleted) {
      this.logger.log(`️ Ride deleted: ${token}`);
    }
    return deleted;
  }

  /**
   * Get all active rides (not expired)
   */
  getActiveRides(): PublicRide[] {
    const now = Date.now();
    return Array.from(this.rides.values()).filter(
      (ride) => new Date(ride.expiresAt).getTime() > now,
    );
  }

  /**
   * Clean up expired rides (call periodically)
   */
  cleanupExpiredRides(): number {
    const now = Date.now();
    let count = 0;

    for (const [token, ride] of this.rides.entries()) {
      if (new Date(ride.expiresAt).getTime() <= now) {
        this.rides.delete(token);
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(` Cleaned up ${count} expired ride(s)`);
    }

    return count;
  }
}
