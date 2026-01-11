import { Body, Controller, Post } from '@nestjs/common';
import { GeocodingService } from '../services/geocoding.service';

type PriorityInput = 'P0' | 'P1' | 'P2' | 'P3' | number | undefined;

@Controller('api/hospitals')
export class HospitalsController {
  constructor(private readonly geocoding: GeocodingService) {}

  /**
   * POST /api/hospitals/nearest
   * Body: { address?: string, lat?: number, lng?: number, priority?: 'P0'|'P1'|'P2'|'P3'|number }
   */
  @Post('nearest')
  async getNearestHospital(
    @Body() body: { address?: string; lat?: number; lng?: number; priority?: PriorityInput },
  ) {
    const { address, lat, lng, priority } = body || {};

    if (!address && (lat == null || lng == null)) {
      return { success: false, message: 'Address or coordinates are required' };
    }

    const location = address
      ? await this.geocoding.geocodeAddress(address)
      : { lat: Number(lat), lng: Number(lng) };

    if (!location || Number.isNaN(location.lat) || Number.isNaN(location.lng)) {
      return { success: false, message: 'Unable to geocode address' };
    }

    const hospitals = await this.geocoding.findNearestHospitals(location, 15);
    if (!hospitals.length) {
      return { success: false, message: 'No hospital found' };
    }

    const nearestHospital = hospitals[0];
    const eta = this.geocoding.calculateETA(nearestHospital.distance, this.normalizePriority(priority));

    return {
      success: true,
      nearestHospital,
      patientLocation: location,
      eta,
    };
  }

  private normalizePriority(priority: PriorityInput): 'P0' | 'P1' | 'P2' | 'P3' {
    if (priority === 'P0' || priority === 'P1' || priority === 'P2' || priority === 'P3') {
      return priority;
    }
    if (typeof priority === 'number') {
      if (priority <= 1) return 'P0';
      if (priority === 2) return 'P1';
      if (priority === 3) return 'P2';
      return 'P3';
    }
    return 'P3';
  }
}
