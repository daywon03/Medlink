import { Injectable, Logger } from '@nestjs/common';

/**
 * Service dédié à l'extraction structurée de données médicales via Groq AI.
 * Utilise un prompt engineering spécifique pour forcer une sortie JSON structurée
 * à partir du texte brut des transcriptions d'appels d'urgence.
 */

export interface GroqExtractionResult {
  patientAge: number | null;
  patientGender: 'homme' | 'femme' | 'unknown';
  symptoms: string[];
  medicalHistory: string[];
  isConscious: boolean | null;
  isBreathing: boolean | null;
  hasBleeding: boolean | null;
  extractionConfidence: number;
}

@Injectable()
export class GroqExtractionService {
  private readonly logger = new Logger(GroqExtractionService.name);

  private readonly EXTRACTION_PROMPT = `Tu es un expert en régulation médicale d'urgence. À partir de la transcription suivante d'un appel au SAMU, extrais les informations médicales structurées.

RÈGLES STRICTES:
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après.
- Si une information n'est pas mentionnée, utilise null pour les booléens/nombres et [] pour les tableaux.
- Pour le genre, utilise "homme", "femme", ou "unknown".
- La confiance (extractionConfidence) est un nombre entre 0 et 1 indiquant ta certitude globale.

FORMAT JSON ATTENDU:
{
  "patientAge": <number|null>,
  "patientGender": "<homme|femme|unknown>",
  "symptoms": ["symptôme1", "symptôme2"],
  "medicalHistory": ["antécédent1", "antécédent2"],
  "isConscious": <true|false|null>,
  "isBreathing": <true|false|null>,
  "hasBleeding": <true|false|null>,
  "extractionConfidence": <0.0-1.0>
}

TRANSCRIPTION:
`;

  /**
   * Extrait les données structurées d'une transcription via Groq AI
   */
  async extractFromTranscription(transcriptionText: string): Promise<GroqExtractionResult> {
    if (!process.env.GROQ_API_KEY) {
      this.logger.warn('⚠️ GROQ_API_KEY non définie, extraction impossible');
      return this.getDefaultResult();
    }

    if (!transcriptionText || transcriptionText.trim().length < 10) {
      this.logger.warn('⚠️ Transcription trop courte pour extraction');
      return this.getDefaultResult();
    }

    try {
      this.logger.log(`🤖 Extraction structurée Groq (${transcriptionText.length} chars)...`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: this.EXTRACTION_PROMPT + transcriptionText,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error('Réponse Groq vide');
      }

      this.logger.log(`✅ Groq extraction réussie (tokens: ${data.usage?.total_tokens || 'N/A'})`);

      return this.parseGroqResponse(rawContent);
    } catch (error: any) {
      this.logger.error(`❌ Erreur extraction Groq: ${error.message}`);
      return this.fallbackRegexExtraction(transcriptionText);
    }
  }

  /**
   * Parse la réponse JSON de Groq avec validation
   */
  private parseGroqResponse(rawContent: string): GroqExtractionResult {
    try {
      // Nettoyer le contenu (enlever markdown si présent)
      let cleaned = rawContent.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);

      const result: GroqExtractionResult = {
        patientAge: this.validateAge(parsed.patientAge),
        patientGender: this.validateGender(parsed.patientGender),
        symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.filter((s: any) => typeof s === 'string') : [],
        medicalHistory: Array.isArray(parsed.medicalHistory) ? parsed.medicalHistory.filter((s: any) => typeof s === 'string') : [],
        isConscious: typeof parsed.isConscious === 'boolean' ? parsed.isConscious : null,
        isBreathing: typeof parsed.isBreathing === 'boolean' ? parsed.isBreathing : null,
        hasBleeding: typeof parsed.hasBleeding === 'boolean' ? parsed.hasBleeding : null,
        extractionConfidence: this.validateConfidence(parsed.extractionConfidence),
      };

      this.logger.log(
        `📋 Extraction: Age=${result.patientAge}, Symptoms=[${result.symptoms.join(', ')}], ` +
        `Conscious=${result.isConscious}, Breathing=${result.isBreathing}, Bleeding=${result.hasBleeding}, ` +
        `Confidence=${result.extractionConfidence}`,
      );

      return result;
    } catch (parseError: any) {
      this.logger.error(`❌ Parse JSON échoué: ${parseError.message}`);
      this.logger.debug(`Raw content: ${rawContent.substring(0, 200)}`);
      return this.getDefaultResult();
    }
  }

  /**
   * Extraction fallback par regex si Groq échoue
   */
  private fallbackRegexExtraction(text: string): GroqExtractionResult {
    this.logger.log('🔄 Fallback regex extraction...');
    const lower = text.toLowerCase();

    const result: GroqExtractionResult = {
      patientAge: null,
      patientGender: 'unknown',
      symptoms: [],
      medicalHistory: [],
      isConscious: null,
      isBreathing: null,
      hasBleeding: null,
      extractionConfidence: 0.3,
    };

    // Âge
    const ageMatch = text.match(/\b(\d{1,3})\s*(ans?|années?)\b/i);
    if (ageMatch) result.patientAge = parseInt(ageMatch[1]);

    // Genre
    if (/\b(mon\s+(père|mari|frère|fils|grand-père)|monsieur|homme|garçon|il\s+(est|a))\b/i.test(lower)) {
      result.patientGender = 'homme';
    } else if (/\b(ma\s+(mère|femme|s[oœ]ur|fille|grand-mère)|madame|femme|fille|elle\s+(est|a))\b/i.test(lower)) {
      result.patientGender = 'femme';
    }

    // Conscience
    if (/\b(inconscient|ne\s+répond\s+(plus|pas)|ne\s+bouge\s+plus|inerte)\b/i.test(lower)) {
      result.isConscious = false;
    } else if (/\b(conscient|éveillé|parle|répond)\b/i.test(lower)) {
      result.isConscious = true;
    }

    // Respiration
    if (/\b(ne\s+respire\s+plus|arrêt\s+respiratoire|apnée|pas\s+de\s+respiration)\b/i.test(lower)) {
      result.isBreathing = false;
    } else if (/\b(respire|respiration)\b/i.test(lower)) {
      result.isBreathing = true;
    }

    // Hémorragie
    if (/\b(saigne|hémorragie|sang|saignement)\b/i.test(lower)) {
      result.hasBleeding = true;
    }

    // Symptômes
    const symptomPatterns: [RegExp, string][] = [
      [/douleur\s+thoracique|mal\s+à\s+la\s+poitrine/i, 'douleur thoracique'],
      [/douleur|mal|souffre/i, 'douleur'],
      [/dyspnée|du\s+mal\s+à\s+respirer|difficulté\s+respiratoire/i, 'dyspnée'],
      [/chute|tombé|est\s+tombé/i, 'chute'],
      [/fracture|cassé/i, 'fracture'],
      [/convulsions?|épileps/i, 'convulsions'],
      [/brûlure|brûlé/i, 'brûlure'],
      [/fièvre|température/i, 'fièvre'],
      [/vomiss|nausée/i, 'nausées/vomissements'],
      [/malaise|évanouissement/i, 'malaise'],
    ];

    for (const [pattern, label] of symptomPatterns) {
      if (pattern.test(lower) && !result.symptoms.includes(label)) {
        result.symptoms.push(label);
      }
    }

    this.logger.log(`📋 Fallback extraction: ${JSON.stringify(result)}`);
    return result;
  }

  private validateAge(value: unknown): number | null {
    if (typeof value !== 'number') return null;
    if (value < 0 || value > 150) return null;
    return Math.round(value);
  }

  private validateGender(value: unknown): 'homme' | 'femme' | 'unknown' {
    if (value === 'homme' || value === 'femme') return value;
    if (value === 'male' || value === 'masculin') return 'homme';
    if (value === 'female' || value === 'féminin') return 'femme';
    return 'unknown';
  }

  private validateConfidence(value: unknown): number {
    if (typeof value !== 'number') return 0;
    return Math.max(0, Math.min(1, value));
  }

  private getDefaultResult(): GroqExtractionResult {
    return {
      patientAge: null,
      patientGender: 'unknown',
      symptoms: [],
      medicalHistory: [],
      isConscious: null,
      isBreathing: null,
      hasBleeding: null,
      extractionConfidence: 0,
    };
  }
}
