/**
 * Allowed datasets for Value Dashboard / model-view-output API.
 * Only these identifiers may be requested; each maps to fixed SQL (no user SQL).
 */

export const VALUE_DASHBOARD_SOURCE_IDS = [
  "milestone",
  "fnmodelorg",
  "portfolio",
  "project",
  "product"
] as const;

export type ValueDashboardSourceId =
  (typeof VALUE_DASHBOARD_SOURCE_IDS)[number];

const IDS = new Set<string>(VALUE_DASHBOARD_SOURCE_IDS);

export function isValueDashboardSourceId(
  v: string
): v is ValueDashboardSourceId {
  return IDS.has(v);
}

export type ValueDashboardSourceConfig = {
  id: ValueDashboardSourceId;
  label: string;
  /** `SELECT * FROM …` fragment (quoted). */
  quotedFrom: string;
  kind: "table" | "tvf";
  informationSchema?: { schema: string; table: string };
  objectIdForMetadata?: string;
};

export const VALUE_DASHBOARD_SOURCES: readonly ValueDashboardSourceConfig[] =
  [
    {
      id: "milestone",
      label: "Milestone (dbo.milestone)",
      quotedFrom: "[dbo].[milestone]",
      kind: "table",
      informationSchema: { schema: "dbo", table: "milestone" }
    },
    {
      id: "fnmodelorg",
      label: "FnModelOrg (dbo.FnModelOrg)",
      quotedFrom: "[dbo].[FnModelOrg]()",
      kind: "tvf",
      objectIdForMetadata: "dbo.FnModelOrg"
    },
    {
      id: "portfolio",
      label: "Portfolio (dbo.portfolio)",
      quotedFrom: "[dbo].[portfolio]",
      kind: "table",
      informationSchema: { schema: "dbo", table: "portfolio" }
    },
    {
      id: "project",
      label: "Project (dbo.project)",
      quotedFrom: "[dbo].[project]",
      kind: "table",
      informationSchema: { schema: "dbo", table: "project" }
    },
    {
      id: "product",
      label: "Product (dbo.product)",
      quotedFrom: "[dbo].[product]",
      kind: "table",
      informationSchema: { schema: "dbo", table: "product" }
    }
  ];

export function getValueDashboardSourceConfig(
  id: string | null | undefined
): ValueDashboardSourceConfig | null {
  if (!id || !isValueDashboardSourceId(id)) return null;
  return VALUE_DASHBOARD_SOURCES.find((s) => s.id === id) ?? null;
}

export const DEFAULT_VALUE_DASHBOARD_SOURCE_ID: ValueDashboardSourceId =
  "fnmodelorg";
