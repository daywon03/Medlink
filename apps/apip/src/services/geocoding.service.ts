import { Injectable, Logger } from '@nestjs/common';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance: number; // en km
  type: 'hospital' | 'emergency' | 'fire_station';
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️ GOOGLE_MAPS_API_KEY not configured');
    } else {
      this.logger.log(`🗝️ Google Maps API key loaded (${this.apiKey.length} chars)`);
    }
  }

  /**
   * Convertir adresse en coordonnées (lat, lng)
   * Utilise Google Maps Geocoding API
   */
  async geocodeAddress(address: string): Promise<Location | null> {
    try {
      if (!address || address.trim().length < 5) {
        return null;
      }

      if (!this.apiKey) {
        this.logger.error('❌ Google Maps API key not configured');
        return null;
      }

      // Google Maps Geocoding API
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=fr&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;

        this.logger.log(`📍 Geocodé: "${address}" → ${location.lat}, ${location.lng}`);
        return {
          lat: location.lat,
          lng: location.lng,
          address: result.formatted_address
        };
      }

      this.logger.warn(
        `⚠️ Adresse non trouvée: "${address}" (status: ${data.status})` +
          (data.error_message ? ` - ${data.error_message}` : '')
      );
      return null;
    } catch (error) {
      this.logger.error(`Geocoding failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Trouver hôpitaux les plus proches
   * Utilise Google Maps Places API (Nearby Search)
   */
  async findNearestHospitals(location: Location, radiusKm = 10): Promise<Hospital[]> {
    try {
      if (!this.apiKey) {
        this.logger.error('❌ Google Maps API key not configured');
        return [];
      }

      const radiusMeters = radiusKm * 1000;

      // Google Places API - Nearby Search pour hôpitaux
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radiusMeters}&type=hospital&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const hospitals = data.results
          .map((place: any) => {
            const lat = place.geometry.location.lat;
            const lng = place.geometry.location.lng;

            return {
              id: `google-${place.place_id}`,
              name: place.name,
              address: place.vicinity || place.formatted_address || 'Adresse inconnue',
              lat,
              lng,
              distance: this.calculateDistance(location.lat, location.lng, lat, lng),
              type: 'hospital' as const
            };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5); // Top 5

        this.logger.log(`🏥 Trouvé ${hospitals.length} hôpitaux dans ${radiusKm}km via Google Maps`);
        return hospitals;
      }

      this.logger.warn(
        `⚠️ Aucun hôpital trouvé dans ${radiusKm}km (status: ${data.status})` +
          (data.error_message ? ` - ${data.error_message}` : '')
      );
      return [];
    } catch (error) {
      this.logger.error(`Find hospitals failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Trouver casernes pompiers les plus proches
   * Utilise Google Maps Places API
   */
  async findNearestFireStations(location: Location, radiusKm = 10): Promise<Hospital[]> {
    try {
      if (!this.apiKey) {
        this.logger.error('❌ Google Maps API key not configured');
        return [];
      }

      const radiusMeters = radiusKm * 1000;

      // Google Places API - fire_station
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radiusMeters}&type=fire_station&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const stations = data.results
          .map((place: any) => {
            const lat = place.geometry.location.lat;
            const lng = place.geometry.location.lng;

            return {
              id: `google-fire-${place.place_id}`,
              name: place.name,
              address: place.vicinity || place.formatted_address || 'Adresse inconnue',
              lat,
              lng,
              distance: this.calculateDistance(location.lat, location.lng, lat, lng),
              type: 'fire_station' as const
            };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3); // Top 3

        this.logger.log(`🚒 Trouvé ${stations.length} casernes pompiers dans ${radiusKm}km via Google Maps`);
        return stations;
      }

      this.logger.warn(
        `⚠️ Aucune caserne trouvée dans ${radiusKm}km` +
          (data.error_message ? ` - ${data.error_message}` : '')
      );
      return [];
    } catch (error) {
      this.logger.error(`Find fire stations failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculer ETA (estimation temps d'arrivée) en minutes
   */
  calculateETA(distanceKm: number, priority: string): number {
    // Vitesses moyennes en ville selon priorité
    const speeds = {
      'P0': 60, // km/h (sirène, urgence vitale)
      'P1': 50,
      'P2': 40,
      'P3': 30
    };

    const speed = speeds[priority] || 40;
    const timeHours = distanceKm / speed;
    const eta = Math.ceil(timeHours * 60); // Minutes

    // Ajouter 2 minutes pour mobilisation
    return eta + 2;
  }

  /**
   * Calculer distance entre 2 points (formule Haversine)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Rayon Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Arrondi 1 décimale
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
