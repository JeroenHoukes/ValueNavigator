/**
 * Shared scenario block types, value fields, and storage helpers.
 * Used by ScenarioBuilderDnD and the scenario wizard.
 */

export type BlockType =
  | "Revenue"
  | "Costs"
  | "Investments"
  | "Risks"
  | "UserSatisfaction"
  | "EmployeeHappiness";

export interface BlockValues {
  [key: string]: string | number;
}

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  values?: BlockValues;
}

export interface SavedScenario {
  id: string;
  name: string;
  pipeline: Block[];
  savedAt: string;
  /** Start date for Gantt/milestone planning (ISO date string YYYY-MM-DD) */
  startDate?: string;
  /** Duration in weeks for Gantt bar length */
  durationWeeks?: number;
  /** Planning horizon in years (used in Edit scenario and Gantt timeline) */
  horizonYears?: number;
}

export type ValueFieldKind = "number" | "text";

export interface ValueFieldConfig {
  key: string;
  label: string;
  kind: ValueFieldKind;
  placeholder?: string;
}

export const BLOCK_VALUE_FIELDS: Record<BlockType, ValueFieldConfig[]> = {
  Revenue: [
    { key: "baseAmount", label: "Base amount (€M)", kind: "number", placeholder: "e.g. 10" },
    { key: "growthPct", label: "Growth %", kind: "number", placeholder: "e.g. 5" }
  ],
  Costs: [
    { key: "amount", label: "Amount (€M)", kind: "number", placeholder: "e.g. 2" },
    { key: "growthPct", label: "Growth %", kind: "number", placeholder: "e.g. 3" }
  ],
  Investments: [
    { key: "capexAmount", label: "Capex (€M)", kind: "number", placeholder: "e.g. 1.5" },
    { key: "year", label: "Year", kind: "number", placeholder: "e.g. 1" }
  ],
  Risks: [
    { key: "adjustmentPct", label: "Adjustment %", kind: "number", placeholder: "e.g. -10" },
    { key: "note", label: "Note", kind: "text", placeholder: "Optional" }
  ],
  UserSatisfaction: [
    { key: "scorePct", label: "Satisfaction score %", kind: "number", placeholder: "e.g. 85" },
    { key: "targetPct", label: "Target %", kind: "number", placeholder: "e.g. 90" },
    { key: "growthImpact", label: "Growth impact %", kind: "number", placeholder: "e.g. 2" }
  ],
  EmployeeHappiness: [
    { key: "scorePct", label: "Happiness score %", kind: "number", placeholder: "e.g. 78" },
    { key: "note", label: "Note", kind: "text", placeholder: "Optional" },
    { key: "growthImpact", label: "Growth impact %", kind: "number", placeholder: "e.g. 1.5" }
  ]
};

export const availableBlocks: Block[] = [
  { id: "rev", type: "Revenue", label: "Revenue Growth" },
  { id: "cost", type: "Costs", label: "Operating Costs" },
  { id: "inv", type: "Investments", label: "Capex" },
  { id: "risk", type: "Risks", label: "Risk Adjustment" },
  { id: "user-sat", type: "UserSatisfaction", label: "User Satisfaction" },
  { id: "emp-happy", type: "EmployeeHappiness", label: "Employee Happiness" }
];

export function getDefaultValues(blockType: BlockType): BlockValues {
  return BLOCK_VALUE_FIELDS[blockType].reduce<BlockValues>((acc, f) => {
    acc[f.key] = f.kind === "number" ? "" : "";
    return acc;
  }, {});
}

export const STORAGE_KEY = "value-navigator-scenarios";

export function loadScenarios(): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: SavedScenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}
