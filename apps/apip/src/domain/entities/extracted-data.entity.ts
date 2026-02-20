/**
 * Domain Entity: ExtractedData
 * AI-extracted structured data from a call conversation
 */
export class ExtractedData {
  constructor(
    public readonly extractionId: string,
    public readonly callId: string,
    public patientAge: number | null = null,
    public patientGender: 'M' | 'F' | 'unknown' = 'unknown',
    public symptoms: string[] = [],
    public medicalHistory: string[] = [],
    public isConscious: boolean | null = null,
    public isBreathing: boolean | null = null,
    public hasBleeding: boolean | null = null,
    public extractionConfidence: number = 0,
    public extractedAt: Date = new Date(),
  ) {}

  /**
   * Calculate a severity score based on extracted data
   * Used by SmartTriageService for priority calculation
   */
  calculateSeverityScore(): number {
    let score = 0;

    // Consciousness
    if (this.isConscious === false) score += 50;

    // Breathing
    if (this.isBreathing === false) score += 50;

    // Bleeding
    if (this.hasBleeding === true) score += 30;

    // Critical symptoms
    const criticalSymptoms = [
      'douleur thoracique', 'arrêt cardiaque', 'avc', 'convulsions',
      'inconscient', 'ne respire plus', 'hémorragie', 'choc',
    ];
    const hasCritical = this.symptoms.some((s) =>
      criticalSymptoms.some((cs) => s.toLowerCase().includes(cs)),
    );
    if (hasCritical) score += 40;

    // Age factor (very young or elderly)
    if (this.patientAge !== null && (this.patientAge > 70 || this.patientAge < 2)) {
      score += 15;
    }

    // Critical medical history
    const criticalHistory = ['cardiaque', 'diabète', 'avc', 'épilepsie', 'asthme'];
    const hasCriticalHistory = this.medicalHistory.some((h) =>
      criticalHistory.some((ch) => h.toLowerCase().includes(ch)),
    );
    if (hasCriticalHistory) score += 10;

    return score;
  }

  hasEnoughData(): boolean {
    return this.extractionConfidence >= 0.5;
  }
}
