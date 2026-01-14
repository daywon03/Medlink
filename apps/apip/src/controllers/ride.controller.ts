import {
  Controller,
  Get,
  Param,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

import { GeocodingService } from "../services/geocoding.service";

@Controller("api/public/ride")
export class RideController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly geocodingService: GeocodingService
  ) {}

  @Get(":token")
  async getRide(@Param("token") token: string) {
    if (!token || token.length < 3) {
      throw new NotFoundException({ error: "invalid_token" });
    }

    try {
      const { data: call, error: callError } = await this.supabase["supabase"]
        .from("calls")
        .select(
          `
          call_id,
          extracted_address,
          triage_reports (
            nearest_hospital_data,
            estimated_arrival_minutes,
            data_json_synthese,
            patient_location
          )
        `,
        )
        .eq("call_id", token)
        .single();

      if (callError || !call) {
        // Fallback to mock data matching previous implementation
        return {
          token,
          status: "en_route",
          ambulance: { label: "AMB-12" },
          destinationHospital: {
            name: "Hôpital Européen Georges-Pompidou",
            address: "20 Rue Leblanc, 75015 Paris",
            lat: 48.8386,
            lng: 2.273,
          },
          incident: { label: "Paris 15e", lat: 48.8414, lng: 2.3007 },
          ambulancePos: {
            lat: 48.834,
            lng: 2.287,
            updatedAt: new Date().toISOString(),
          },
          etaMinutes: 7,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        };
      }

      const triageReport = call.triage_reports?.[0];
      const hospitalData = this.parseHospitalData(
        triageReport?.nearest_hospital_data,
      );

      // 🆕 Parse patient location
      let incidentLocation: { lat: number; lng: number; address?: string } | null = null;
      if (triageReport?.patient_location) {
        incidentLocation = typeof triageReport.patient_location === 'string'
          ? this.safeJsonParse(triageReport.patient_location)
          : triageReport.patient_location;
      }

      // 🔄 If no coordinates but address exists, OR if coordinates are default Paris, geocode on the fly
      if ((!incidentLocation || !incidentLocation.lat || (incidentLocation.lat === 48.8566 && incidentLocation.lng === 2.3522)) && call.extracted_address) {
        try {
          const geocoded = await this.geocodingService.geocodeAddress(call.extracted_address);
          if (geocoded) {
            incidentLocation = {
              lat: geocoded.lat,
              lng: geocoded.lng,
              address: geocoded.address || call.extracted_address
            };
          }
        } catch (err) {
            console.error('Failed to geocode on the fly:', err);
        }
      }

      // Parse synthese for ambulance data
      let synthese: any = {};
      try {
        if (triageReport?.data_json_synthese) {
          synthese =
            typeof triageReport.data_json_synthese === "string"
              ? JSON.parse(triageReport.data_json_synthese)
              : triageReport.data_json_synthese;
        }
      } catch (e) {
        console.error("Synthese parse error", e);
      }

      const ambulance = synthese?.ambulance || {
        label: "Recherche en cours...",
      };
      const ambulancePos = synthese?.ambulancePos || {
        lat: 48.8566,
        lng: 2.3522,
        updatedAt: new Date().toISOString(),
      };

      const status = synthese?.ambulance ? "assigned" : "en_route";

      return {
        token,
        status,
        ambulance,
        destinationHospital: hospitalData || {
          name: "Hôpital le plus proche",
          address: "En cours de localisation",
          lat: 48.8566,
          lng: 2.3522,
        },
        incident: {
          label: incidentLocation?.address || call.extracted_address || "Localisation inconnue",
          lat: Number(incidentLocation?.lat ?? 48.8566),
          lng: Number(incidentLocation?.lng ?? 2.3522),
        },
        ambulancePos,
        etaMinutes: triageReport?.estimated_arrival_minutes || null,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
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
