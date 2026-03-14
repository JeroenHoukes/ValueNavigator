"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { apiScope } from "@/config/msalConfig";

interface ScenarioInput {
  name: string;
  description: string;
  horizonYears: number;
  discountRate: number;
}

interface ForecastResult {
  npv: number;
  irr: number;
  paybackPeriodYears: number;
}

export default function ScenarioEditPage() {
  const params = useParams<{ id: string }>();
  const { instance, accounts } = useMsal();
  const [inputs, setInputs] = useState<ScenarioInput>({
    name: "Base Case",
    description: "Default scenario",
    horizonYears: 5,
    discountRate: 8
  });
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params?.id) {
      setInputs((prev) => ({ ...prev, name: `Scenario ${params.id}` }));
    }
  }, [params?.id]);

  async function runForecast() {
    setIsRunning(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (accounts.length > 0 && apiScope && !apiScope.includes("YOUR_API")) {
        try {
          const { accessToken } = await instance.acquireTokenSilent({
            scopes: [apiScope],
            account: accounts[0]
          });
          (headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
        } catch {
          // Token acquisition failed – proceed without auth if API allows
        }
      }
      const response = await fetch(`${baseUrl}/api/forecast/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          scenarioId: params?.id,
          ...inputs
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as ForecastResult;
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Edit Scenario</h2>
          <p className="text-xs text-slate-400">
            Scenario ID: <span className="font-mono">{params?.id}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={runForecast}
          disabled={isRunning}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isRunning ? "Running forecast..." : "Run forecast"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <h3 className="font-semibold mb-1">Inputs</h3>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                value={inputs.name}
                onChange={(e) => setInputs({ ...inputs, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                rows={3}
                value={inputs.description}
                onChange={(e) =>
                  setInputs({ ...inputs, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Horizon (years)
                </label>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  value={inputs.horizonYears}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      horizonYears: Number(e.target.value)
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Discount Rate (%)
                </label>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  value={inputs.discountRate}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      discountRate: Number(e.target.value)
                    })
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <h3 className="font-semibold mb-1">Forecast Result</h3>
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
              {error}
            </p>
          )}
          {!result && !error && (
            <p className="text-sm text-slate-400">
              Run a forecast to see NPV, IRR and payback period.
            </p>
          )}
          {result && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-400">NPV</p>
                <p className="mt-1 text-lg font-semibold">
                  €{result.npv.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-400">IRR</p>
                <p className="mt-1 text-lg font-semibold">
                  {result.irr.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-400">Payback</p>
                <p className="mt-1 text-lg font-semibold">
                  {result.paybackPeriodYears.toFixed(1)} yrs
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
