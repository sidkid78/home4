export interface Risk {
  id: string;
  category: 'FALL_HAZARD' | 'OBSTRUCTION' | 'LIGHTING';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  recommendation: string;
  estimated_cost_range: [number, number];
}

export interface Measurement {
  feature: 'doorway_width' | 'counter_height' | 'toilet_height' | 'grab_bar_height';
  estimated_value_inches: number;
  confidence_interval: 'low' | 'medium' | 'high';
  logic: string;
}

export interface BoqItem {
  name: string;
  price: number;
  qty: number;
}

export interface ProcessResult {
  captureId: string;
  hitlStatus: 'COMPLETED' | 'NEEDS_REVIEW';
  report: {
    id: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    priorityScore: number;
    estimatedValue: number;
    roiValue: number;
    materialCount: number;
    isHighValueLead: boolean;
  };
  lead: {
    id: string;
    price: number;
    status: string;
  };
  health: HealthScore | null;
  assessment: {
    roomSummary: string;
    confidenceScore: number;
    humanValidated: boolean;
    risks: Risk[];
    measurements: Measurement[];
  };
  boq: BoqItem[];
}

export interface DemoActors {
  propertyId: string;
  ownerId: string;
  contractorId: string;
}

export interface LeadTeaser {
  id: string;
  price: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  roomType: string;
  estimatedValue: number;
  roiValue: number;
  materialCount: number;
  isHighValueLead: boolean;
  riskCount: number;
  reportId: string;
}

export interface UnlockedReport {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  estimatedValue: number;
  roiValue: number;
  materialCount: number;
  isHighValueLead: boolean;
  roomType: string | null;
  boq: BoqItem[];
  assessment: {
    risks: Risk[];
    measurements: Measurement[];
    confidenceScore: number;
    humanValidated: boolean;
  } | null;
}

export interface HealthScore {
  overallScore: number;
  mobilityScore: number;
  fallRiskScore: number;
  changeDelta: number | null;
}
