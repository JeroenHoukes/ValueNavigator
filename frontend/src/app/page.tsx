import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold mb-2">Welcome to Value Navigator</h2>
        <p className="text-slate-300 max-w-2xl">
          Build scenarios, run forecasts, and understand the value impact of your
          strategic decisions. Start by creating a scenario or reviewing forecast
          results in the dashboard.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-brand transition-colors"
        >
          <h3 className="font-semibold mb-1">Dashboard</h3>
          <p className="text-sm text-slate-400">
            View key KPIs, scenario comparisons, and forecast summaries.
          </p>
        </Link>

        <Link
          href="/scenarios/builder"
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-brand transition-colors"
        >
          <h3 className="font-semibold mb-1">Scenario Builder</h3>
          <p className="text-sm text-slate-400">
            Drag-and-drop assumptions and drivers to design new scenarios.
          </p>
        </Link>

        <Link
          href="/scenarios"
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-brand transition-colors"
        >
          <h3 className="font-semibold mb-1">Scenarios</h3>
          <p className="text-sm text-slate-400">
            Open or delete saved scenarios, or start a new one in the builder.
          </p>
        </Link>
      </section>
    </div>
  );
}

