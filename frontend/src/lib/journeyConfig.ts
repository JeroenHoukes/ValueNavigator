/**
 * Customer journey step and storage.
 * Step metrics align with scenario building blocks: volume, revenue, costs, growth, satisfaction (+ capex, risk).
 */

export interface JourneyStepMetrics {
  volume?: number | "";
  /** For subsequent steps: % of the selected base step's volume that goes through this step (e.g. 25) */
  proportionOfFirstStepPct?: number | "";
  /** 0-based index of the step whose volume is used for proportion (default 0 = first step) */
  proportionBaseStepIndex?: number;
  revenue?: number | "";
  costs?: number | "";
  growthPct?: number | "";
  satisfactionPct?: number | "";
  capex?: number | "";
  riskAdjustmentPct?: number | "";
}

export interface JourneyStep {
  id: string;
  name: string;
  metrics: JourneyStepMetrics;
}

export interface SavedJourney {
  id: string;
  name: string;
  steps: JourneyStep[];
  savedAt: string;
}

export const JOURNEY_STORAGE_KEY = "value-navigator-customer-journeys";

export const STEP_METRIC_FIELDS: { key: keyof JourneyStepMetrics; label: string; placeholder: string }[] = [
  { key: "volume", label: "Volume", placeholder: "e.g. 1000" },
  { key: "revenue", label: "Revenue (€M)", placeholder: "e.g. 2.5" },
  { key: "costs", label: "Costs (€M)", placeholder: "e.g. 1.2" },
  { key: "growthPct", label: "Growth %", placeholder: "e.g. 5" },
  { key: "satisfactionPct", label: "Satisfaction %", placeholder: "e.g. 85" },
  { key: "capex", label: "Capex (€M)", placeholder: "e.g. 0.5" },
  { key: "riskAdjustmentPct", label: "Risk adjustment %", placeholder: "e.g. -10" }
];

export function defaultStepMetrics(): JourneyStepMetrics {
  return {
    volume: "",
    proportionOfFirstStepPct: "",
    proportionBaseStepIndex: 0,
    revenue: "",
    costs: "",
    growthPct: "",
    satisfactionPct: "",
    capex: "",
    riskAdjustmentPct: ""
  };
}

export function createStep(name: string, index: number, initialMetrics?: Partial<JourneyStepMetrics>): JourneyStep {
  const metrics = { ...defaultStepMetrics(), ...initialMetrics };
  return {
    id: `step-${Date.now()}-${index}`,
    name: name || `Step ${index + 1}`,
    metrics
  };
}

export function loadJourneys(): SavedJourney[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveJourneys(journeys: SavedJourney[]) {
  localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journeys));
}
