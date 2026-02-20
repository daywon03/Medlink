import {
  Controller,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { RideService } from "../services/ride.service";
import { GeocodingService } from "../services/geocoding.service";

@Controller("api/public/ride")
export class RideController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly rideService: RideService,
    private readonly geocodingService: GeocodingService
  ) {}

  @Get(":token")
  async getRide(@Param("token") token: string) {
    if (!token || token.length < 3) {
      throw new NotFoundException({ error: "invalid_token" });
    }

    // ✅ 1. Check in-memory ride data first (live tracking from socket events)
    const liveRide = this.rideService.findByToken(token);
    if (liveRide) {
      return liveRide;
    }

    // ✅ 2. Fall back to DB query
    try {
      const { data: call, error: callError } = await this.supabase["supabase"]
        .from("emergency_calls")
        .select(
          `
          call_id,
          location_input_text,
          triage_reports (
            nearest_hospital_data,
            estimated_arrival_minutes,
            data_json_synthese,
            patient_location
          ),
          assignments (
            ambulance_team,
            tracking_token,
            status
          )
        `,
        )
        .eq("call_id", token)
        .single();

      if (callError || !call) {
        throw new NotFoundException({ error: "Lien invalide ou expiré." });
      }

      const triageReport = Array.isArray(call.triage_reports)
        ? call.triage_reports[0]
        : call.triage_reports;
      const assignment = Array.isArray(call.assignments)
        ? call.assignments[0]
        : call.assignments;

      const hospitalData = this.parseHospitalData(
        triageReport?.nearest_hospital_data,
      );

      // Parse patient location
      let incidentLocation: { lat: number; lng: number; address?: string } | null = null;
      if (triageReport?.patient_location) {
        incidentLocation = typeof triageReport.patient_location === 'string'
          ? this.safeJsonParse(triageReport.patient_location)
          : triageReport.patient_location;
      }

      // Geocode on the fly if needed
      if ((!incidentLocation || !incidentLocation.lat || (incidentLocation.lat === 48.8566 && incidentLocation.lng === 2.3522)) && call.location_input_text) {
        try {
          const geocoded = await this.geocodingService.geocodeAddress(call.location_input_text);
          if (geocoded) {
            incidentLocation = {
              lat: geocoded.lat,
              lng: geocoded.lng,
              address: geocoded.address || call.location_input_text
            };
          }
        } catch (err) {
            console.error('Failed to geocode on the fly:', err);
        }
      }

      // Ambulance info from assignment
      const ambulanceLabel = assignment?.ambulance_team || "En attente d'assignation";

      return {
        token,
        status: assignment?.status || "assigned",
        ambulance: { label: ambulanceLabel },
        destinationHospital: hospitalData || {
          name: "Hôpital le plus proche",
          address: "En cours de localisation",
          lat: 48.8566,
          lng: 2.3522,
        },
        incident: {
          label: incidentLocation?.address || call.location_input_text || "Localisation inconnue",
          lat: Number(incidentLocation?.lat ?? 48.8566),
          lng: Number(incidentLocation?.lng ?? 2.3522),
        },
        ambulancePos: {
          lat: Number(incidentLocation?.lat ?? 48.8566),
          lng: Number(incidentLocation?.lng ?? 2.3522),
          updatedAt: new Date().toISOString(),
        },
        etaMinutes: triageReport?.estimated_arrival_minutes || null,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error("Error fetching ride data:", error);
      throw new InternalServerErrorException({ error: "internal_error" });
    }
  }

  private parseHospitalData(value: unknown) {
    if (!value) return null;
    const parsed =
      typeof value === "string" ? this.safeJsonParse(value) : value;
    if (!parsed || typeof parsed !== "object") return null;
    const hospital = parsed as {
      name?: string;
      address?: string;
      lat?: number;
      lng?: number;
    };
    if (!hospital.name) return null;
    const lat = Number(hospital.lat);
    const lng = Number(hospital.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { ...hospital, lat, lng };
  }

  private safeJsonParse(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
