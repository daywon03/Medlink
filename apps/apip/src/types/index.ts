// Shared types for WebSocket communication

export type IncidentStatus = "nouveau" | "en_cours" | "clos";

export interface Incident {
  id: string;
  createdAt: string;
  status: IncidentStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  symptoms: string[];
  notes?: string;
}

export type RideStatus =
  | "assigned"
  | "en_route"
  | "on_scene"
  | "transport"
  | "arrived";

export interface PublicRide {
  token: string;
  status: RideStatus;
  ambulance: { label: string };
  destinationHospital: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  incident: {
    label: string;
    lat: number;
    lng: number;
  };
  ambulancePos: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  etaMinutes?: number;
  expiresAt: string;
}

export interface ArmActionPayload {
  type:
    | "assign_ambulance"
    | "edit_incident"
    | "notify_citizen"
    | "notify_hospital"
    | "create_incident";
  incidentId?: string;
  team?: string;
  notes?: string;
  message?: string;
  hospital?: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  etaMinutes?: number;
  incident?: Incident;
}

export interface TrackingAssignPayload {
  token: string;
  status: RideStatus;
  ambulance: { label: string };
  incident: { label: string; lat: number; lng: number };
  destinationHospital: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  ambulancePos: { lat: number; lng: number; updatedAt: string };
  etaMinutes?: number;
  expiresAt: string;
}
