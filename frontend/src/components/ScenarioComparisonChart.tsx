"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export interface ScenarioDatum {
  id: number;
  name: string;
  npv: number;
  irr: number;
}

interface ScenarioComparisonChartProps {
  scenarios: ScenarioDatum[];
}

export function ScenarioComparisonChart({ scenarios }: ScenarioComparisonChartProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="font-semibold mb-3">Scenario Comparison (Chart)</h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={scenarios}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
            />
            <YAxis
              yAxisId="npv"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
              tickFormatter={(v) => `€${v}M`}
              label={{
                value: "NPV (€M)",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
                style: { fontSize: 11 }
              }}
            />
            <YAxis
              yAxisId="irr"
              orientation="right"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "IRR (%)",
                angle: 90,
                position: "insideRight",
                fill: "#94a3b8",
                style: { fontSize: 11 }
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px"
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={((value: unknown, name?: string) => {
                const numeric =
                  typeof value === "number"
                    ? value
                    : value != null
                    ? Number(value)
                    : 0;
                const n = String(name ?? "");
                return [
                  n === "npv"
                    ? `€${numeric.toFixed(1)}M`
                    : `${numeric.toFixed(1)}%`,
                  n === "npv" ? "NPV (€M)" : "IRR (%)"
                ];
              }) as React.ComponentProps<typeof Tooltip>["formatter"]}
              labelFormatter={(label) => label}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => (value === "npv" ? "NPV (€M)" : "IRR (%)")}
            />
            <Bar
              yAxisId="npv"
              dataKey="npv"
              fill="var(--color-brand, #6366f1)"
              name="npv"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="irr"
              dataKey="irr"
              fill="#38bdf8"
              name="irr"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
