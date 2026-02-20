import { Call } from '../../domain/entities';

/**
 * Application Layer Interface: Call Repository
 * Abstracts data access for Call entities
 */
export interface ICallRepository {
  create(citizenId: string, locationInput?: string | null): Promise<Call>;
  findById(callId: string): Promise<Call | null>;
  findAll(filters?: CallFilters): Promise<{ calls: Call[]; total: number }>;
  findClosed(filters?: CallFilters): Promise<{ calls: Call[]; total: number }>;
  updateAddress(callId: string, address: string): Promise<void>;
  finishCall(callId: string): Promise<void>;
}

export interface CallFilters {
  search?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const CALL_REPOSITORY = 'CALL_REPOSITORY';
