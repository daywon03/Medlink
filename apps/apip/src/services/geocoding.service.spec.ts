import { Test, TestingModule } from '@nestjs/testing';
import { GeocodingService, Location, Hospital } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(async () => {
    // Reset process.env to avoid real API calls if key is present
    process.env.GOOGLE_MAPS_API_KEY = 'test_api_key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocodingService],
    }).compile();

    service = module.get<GeocodingService>(GeocodingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateETA', () => {
    it('should calculate base ETA correctly for P3', () => {
      // 10 km at 30 km/h = 20 min + 2 min preparation = 22 min
      const eta = service.calculateETA(10, 'P3');
      expect(eta).toBe(22);
    });

    it('should calculate ETA with urgency modifier for P0', () => {
      // 10 km at 60 km/h = 10 min + 2 min preparation = 12 min
      const eta = service.calculateETA(10, 'P0');
      expect(eta).toBe(12);
    });

    it('should calculate minimum ETA correctly', () => {
      // 1 km at 60 km/h = 1 min + 2 min prep = 3 min -> P0 = 3 min
      const eta = service.calculateETA(1, 'P0');
      expect(eta).toBeGreaterThan(0);
      expect(eta).toBeLessThan(5);
    });
  });

  describe('geocodeAddress', () => {
    it('should return null if address is too short', async () => {
      const result = await service.geocodeAddress('abc');
      expect(result).toBeNull();
    });

    it('should return location when API call is successful', async () => {
      // Mock global fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'OK',
          results: [
            {
              geometry: { location: { lat: 48.8566, lng: 2.3522 } },
              formatted_address: 'Paris, France',
            },
          ],
        }),
      });

      const result = await service.geocodeAddress('Paris');
      expect(result).toEqual({
        lat: 48.8566,
        lng: 2.3522,
        address: 'Paris, France',
      });
    });

    it('should return null when API returns ZERO_RESULTS', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'ZERO_RESULTS',
          results: [],
        }),
      });

      const result = await service.geocodeAddress('UnknownPlace12345');
      expect(result).toBeNull();
    });
  });

  describe('findNearestHospitals', () => {
    it('should sort hospitals by distance', async () => {
      // Mock global fetch for Places API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'OK',
          results: [
            {
              place_id: '1',
              name: 'Hospital Far',
              vicinity: 'Address 1',
              geometry: { location: { lat: 48.9, lng: 2.4 } },
            },
            {
              place_id: '2',
              name: 'Hospital Near',
              vicinity: 'Address 2',
              geometry: { location: { lat: 48.86, lng: 2.36 } },
            },
          ],
        }),
      });

      const location: Location = { lat: 48.8566, lng: 2.3522 }; // Paris center
      const hospitals = await service.findNearestHospitals(location, 10);

      expect(hospitals.length).toBe(2);
      expect(hospitals[0].name).toBe('Hospital Near');
      expect(hospitals[1].name).toBe('Hospital Far');
      expect(hospitals[0].distance).toBeLessThan(hospitals[1].distance);
    });
  });
});
