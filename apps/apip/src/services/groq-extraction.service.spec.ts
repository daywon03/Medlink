import { Test, TestingModule } from '@nestjs/testing';
import { GroqExtractionService } from './groq-extraction.service';

describe('GroqExtractionService', () => {
  let service: GroqExtractionService;

  beforeEach(async () => {
    process.env.GROQ_API_KEY = 'test_groq_key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GroqExtractionService],
    }).compile();

    service = module.get<GroqExtractionService>(GroqExtractionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractFromTranscription', () => {
    it('should return default result if transcription is too short', async () => {
      const result = await service.extractFromTranscription('bonjour');
      expect(result.patientAge).toBeNull();
      expect(result.symptoms).toEqual([]);
    });

    it('should extract data correctly from Groq API response', async () => {
      // Mock successful Groq response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          usage: { total_tokens: 150 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  patientAge: 45,
                  patientGender: 'homme',
                  symptoms: ['douleur thoracique'],
                  medicalHistory: ['hypertension'],
                  isConscious: true,
                  isBreathing: true,
                  hasBleeding: false,
                  extractionConfidence: 0.95,
                }),
              },
            },
          ],
        }),
      });

      const transcription = 'Monsieur de 45 ans avec douleur thoracique, conscient, respire bien. Antécédents hypertension.';
      const result = await service.extractFromTranscription(transcription);

      expect(global.fetch).toHaveBeenCalled();
      expect(result.patientAge).toBe(45);
      expect(result.patientGender).toBe('homme');
      expect(result.symptoms).toContain('douleur thoracique');
      expect(result.isConscious).toBe(true);
      expect(result.extractionConfidence).toBe(0.95);
    });

    it('should fallback to regex extraction if Groq API fails', async () => {
      // Mock failing Groq API
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const transcription = 'mon grand-père de 80 ans ne respire plus et est inconscient après une chute';
      const result = await service.extractFromTranscription(transcription);

      // Verify that regex fallback worked despite the API error
      expect(result.patientAge).toBe(80);
      expect(result.patientGender).toBe('homme'); // 'mon grand-père'
      expect(result.isConscious).toBe(false); // 'inconscient'
      expect(result.isBreathing).toBe(false); // 'ne respire plus'
      expect(result.symptoms).toContain('chute'); // 'chute'
    });
  });
});
