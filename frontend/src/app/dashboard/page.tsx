import { ScenarioComparisonChart } from "@/components/ScenarioComparisonChart";

async function getMockDashboardData() {
  // In a real implementation this would call the backend API
  // using the user's Entra ID access token.
  return {
    kpis: [
      { label: "Total NPV", value: "€12.3M" },
      { label: "Payback Period", value: "3.4 years" },
      { label: "IRR", value: "18.7%" }
    ],
    scenarios: [
      { id: 1, name: "Base Case", npv: 10.1, irr: 15.2 },
      { id: 2, name: "Upside", npv: 15.8, irr: 21.3 },
      { id: 3, name: "Downside", npv: 7.4, irr: 11.1 }
    ]
  };
}

export default async function DashboardPage() {
  const data = await getMockDashboardData();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Forecast Dashboard</h2>

      <div className="grid md:grid-cols-3 gap-4">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <p className="text-sm text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold">{kpi.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-semibold mb-3">Scenario Comparison</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">Scenario</th>
                <th className="py-2 pr-4">NPV (€M)</th>
                <th className="py-2 pr-4">IRR</th>
              </tr>
            </thead>
            <tbody>
              {data.scenarios.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="py-2 pr-4">{s.name}</td>
                  <td className="py-2 pr-4">{s.npv.toFixed(1)}</td>
                  <td className="py-2 pr-4">{s.irr.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ScenarioComparisonChart scenarios={data.scenarios} />
    </div>
  );
}

