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

  /**
   * Convertir adresse en coordonnées (lat, lng)
   * Utilise OpenStreetMap Nominatim (GRATUIT)
   */
  async geocodeAddress(address: string): Promise<Location | null> {
    try {
      if (!address || address.trim().length < 5) {
        return null;
      }

      // OpenStreetMap Nominatim (gratuit, pas de clé requise)
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=fr`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Medlink-SAMU/1.0'
        }
      });

      const data = await response.json();

      if (data && data.length > 0) {
        this.logger.log(`📍 Geocodé: "${address}" → ${data[0].lat}, ${data[0].lon}`);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name
        };
      }

      this.logger.warn(`⚠️ Adresse non trouvée: "${address}"`);
      return null;
    } catch (error) {
      this.logger.error(`Geocoding failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Trouver hôpitaux les plus proches
   * Utilise Overpass API (OpenStreetMap - GRATUIT)
   */
  async findNearestHospitals(location: Location, radiusKm = 10): Promise<Hospital[]> {
    try {
      const radiusMeters = radiusKm * 1000;

      // Overpass API query pour hôpitaux avec urgences
      const query = `
        [out:json][timeout:10];
        (
          node["amenity"="hospital"](around:${radiusMeters},${location.lat},${location.lng});
          way["amenity"="hospital"](around:${radiusMeters},${location.lat},${location.lng});
          node["healthcare"="hospital"](around:${radiusMeters},${location.lat},${location.lng});
        );
        out center;
      `;

      const url = `https://overpass-api.de/api/interpreter`;
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const hospitals = data.elements.map((element: any) => {
          const lat = element.lat || element.center?.lat;
          const lng = element.lon || element.center?.lon;

          if (!lat || !lng) return null;

          return {
            id: `osm-hospital-${element.id}`,
            name: element.tags?.name || 'Hôpital',
            address: this.formatAddress(element.tags),
            lat,
            lng,
            distance: this.calculateDistance(location.lat, location.lng, lat, lng),
            type: 'hospital' as const
          };
        })
        .filter(h => h !== null)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5); // Top 5

        this.logger.log(`🏥 Trouvé ${hospitals.length} hôpitaux dans ${radiusKm}km`);
        return hospitals;
      }

      this.logger.warn(`⚠️ Aucun hôpital trouvé dans ${radiusKm}km`);
      return [];
    } catch (error) {
      this.logger.error(`Find hospitals failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Trouver casernes pompiers les plus proches
   */
  async findNearestFireStations(location: Location, radiusKm = 10): Promise<Hospital[]> {
    try {
      const radiusMeters = radiusKm * 1000;

      const query = `
        [out:json][timeout:10];
        (
          node["amenity"="fire_station"](around:${radiusMeters},${location.lat},${location.lng});
          way["amenity"="fire_station"](around:${radiusMeters},${location.lat},${location.lng});
        );
        out center;
      `;

      const url = `https://overpass-api.de/api/interpreter`;
      const response = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const stations = data.elements.map((element: any) => {
          const lat = element.lat || element.center?.lat;
          const lng = element.lon || element.center?.lon;

          if (!lat || !lng) return null;

          return {
            id: `osm-fire-${element.id}`,
            name: element.tags?.name || 'Caserne de Pompiers',
            address: this.formatAddress(element.tags),
            lat,
            lng,
            distance: this.calculateDistance(location.lat, location.lng, lat, lng),
            type: 'fire_station' as const
          };
        })
        .filter(s => s !== null)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3); // Top 3

        this.logger.log(`🚒 Trouvé ${stations.length} casernes pompiers dans ${radiusKm}km`);
        return stations;
      }

      this.logger.warn(`⚠️ Aucune caserne trouvée dans ${radiusKm}km`);
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

  /**
   * Formater adresse depuis tags OSM
   */
  private formatAddress(tags: any): string {
    if (!tags) return 'Adresse inconnue';

    const parts: string[] = [];
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
    if (tags['addr:city']) parts.push(tags['addr:city']);

    return parts.length > 0 ? parts.join(' ') : (tags['addr:full'] || 'Adresse inconnue');
  }
}
