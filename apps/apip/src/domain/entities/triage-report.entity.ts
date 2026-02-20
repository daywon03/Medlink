/**
 * Domain Entity: TriageReport
 * AI-generated triage classification for an emergency call
 */
export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P5';

export class TriageReport {
  constructor(
    public readonly reportId: string,
    public readonly callId: string,
    public priority: PriorityLevel,
    public aiExplanation: string,
    public confidence: number,
    public classificationSource: string = 'ai_agent',
    public aiModelVersion: string = 'groq/compound',
    public validatedByDoctor: boolean = false,
    public nearestHospitalData?: any,
    public fireStationData?: any,
    public patientLocation?: any,
    public estimatedArrivalMinutes?: number | null,
    public dataJsonSynthese?: any,
    public transcript?: string | null,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  get priorityNumeric(): 1 | 2 | 3 | 4 | 5 {
    const map: Record<PriorityLevel, 1 | 2 | 3 | 4 | 5> = {
      P0: 1, P1: 2, P2: 3, P3: 4, P5: 5,
    };
    return map[this.priority];
  }

  isVitalEmergency(): boolean {
    return this.priority === 'P0' || this.priority === 'P1';
  }

  isHighConfidence(): boolean {
    return this.confidence >= 0.8;
  }

  validate(): void {
    this.validatedByDoctor = true;
    this.updatedAt = new Date();
  }

  updatePriority(newPriority: PriorityLevel): void {
    this.priority = newPriority;
    this.updatedAt = new Date();
  }
}
