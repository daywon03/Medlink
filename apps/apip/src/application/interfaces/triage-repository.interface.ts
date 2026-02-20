import { TriageReport, PriorityLevel } from '../../domain/entities';

/**
 * Application Layer Interface: Triage Repository
 * Abstracts data access for TriageReport entities
 */
export interface ITriageRepository {
  createOrUpdate(callId: string, data: TriageCreateData): Promise<TriageReport>;
  findByCallId(callId: string): Promise<TriageReport | null>;
  findAll(limit?: number): Promise<TriageReport[]>;
  updateHospital(callId: string, hospital: any, etaMinutes?: number): Promise<void>;
}

export interface TriageCreateData {
  priority: PriorityLevel;
  summary: string;
  confidence: number;
  symptoms?: string[];
  vitalEmergency?: boolean;
  isPartial?: boolean;
  nearestHospital?: any;
  nearestFireStation?: any;
  patientLocation?: any;
  eta?: number;
  agentAdvice?: string;
}

export const TRIAGE_REPOSITORY = 'TRIAGE_REPOSITORY';
