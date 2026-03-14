"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import {
  type BlockType,
  type Block,
  BLOCK_VALUE_FIELDS,
  availableBlocks,
  getDefaultValues,
  loadScenarios,
  saveScenarios,
  type SavedScenario
} from "@/lib/scenarioConfig";

type ParsedRow = Record<string, string | number>;

export default function ScenarioImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedBlockTypes, setSelectedBlockTypes] = useState<BlockType[]>(["Investments"]);
  const [columnToFieldByBlock, setColumnToFieldByBlock] = useState<Record<BlockType, Record<string, string>>>(() =>
    Object.fromEntries(availableBlocks.map((b) => [b.type, {}])) as Record<BlockType, Record<string, string>>
  );
  const [scenarioName, setScenarioName] = useState("Imported from Excel");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleBlockType(blockType: BlockType) {
    setSelectedBlockTypes((prev) =>
      prev.includes(blockType)
        ? prev.filter((t) => t !== blockType)
        : [...prev, blockType]
    );
  }

  function setColumnMappingForBlock(blockType: BlockType, col: string, fieldKey: string) {
    setColumnToFieldByBlock((prev) => ({
      ...prev,
      [blockType]: { ...prev[blockType], [col]: fieldKey }
    }));
  }

  const parseFile = useCallback((f: File) => {
    setFile(f);
    setStatus("idle");
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          setErrorMessage("Could not read file.");
          setRows([]);
          setColumns([]);
          return;
        }
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setErrorMessage("Workbook has no sheets.");
          setRows([]);
          setColumns([]);
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, {
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd"
        });
        if (json.length === 0) {
          setErrorMessage("Sheet is empty.");
          setRows([]);
          setColumns([]);
          return;
        }
        const keys = Object.keys(json[0] as object);
        setColumns(keys);
        setRows(json);
        setColumnToFieldByBlock((prev) => {
          const next = { ...prev } as Record<BlockType, Record<string, string>>;
          (Object.keys(next) as BlockType[]).forEach((bt) => {
            next[bt] = { ...next[bt] };
            keys.forEach((col) => {
              if (!(col in next[bt])) next[bt][col] = "";
            });
          });
          return next;
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to parse Excel.");
        setRows([]);
        setColumns([]);
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  function handleCreateScenario() {
    setStatus("idle");
    setErrorMessage(null);
    if (selectedBlockTypes.length === 0) {
      setErrorMessage("Select at least one block type.");
      setStatus("error");
      return;
    }
    const pipeline: Block[] = [];
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      for (const blockType of selectedBlockTypes) {
        const fieldConfigs = BLOCK_VALUE_FIELDS[blockType];
        const blockLabel = availableBlocks.find((b) => b.type === blockType)?.label ?? blockType;
        const mapping = columnToFieldByBlock[blockType] ?? {};
        const mappedFields = Object.entries(mapping).filter(
          ([_, fieldKey]) => fieldKey && fieldConfigs.some((f) => f.key === fieldKey)
        );
        if (mappedFields.length === 0) {
          setErrorMessage(`Map at least one column for "${blockLabel}".`);
          setStatus("error");
          return;
        }
        const values = getDefaultValues(blockType);
        mappedFields.forEach(([col, fieldKey]) => {
          const raw = row[col];
          const config = fieldConfigs.find((f) => f.key === fieldKey);
          if (config) {
            if (config.kind === "number") {
              const n = typeof raw === "number" ? raw : Number(raw);
              values[fieldKey] = Number.isNaN(n) ? "" : n;
            } else {
              values[fieldKey] = raw != null ? String(raw) : "";
            }
          }
        });
        pipeline.push({
          id: `${blockType}-import-${pipeline.length}`,
          type: blockType,
          label: blockLabel,
          values
        });
      }
    }
    try {
      const scenarios = loadScenarios();
      const payload: SavedScenario = {
        id: crypto.randomUUID(),
        name: scenarioName.trim() || "Imported from Excel",
        pipeline,
        savedAt: new Date().toISOString()
      };
      scenarios.push(payload);
      saveScenarios(scenarios);
      setStatus("success");
    } catch {
      setErrorMessage("Failed to save scenario.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Import Excel to scenario</h2>
        <p className="text-slate-400 text-sm mt-1">
          Upload an Excel file, select one or more block types, and map columns to each. Each row creates one block per selected type (e.g. Capex + Revenue from the same row).
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Upload Excel (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
            }}
            className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:bg-brand/90"
          />
          {file && (
            <p className="text-xs text-slate-500 mt-1">
              {file.name} — {rows.length} row(s), {columns.length} column(s)
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 text-red-300 px-4 py-2 text-sm">
            {errorMessage}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80">
                      {columns.map((col) => (
                        <th key={col} className="px-3 py-2 font-medium text-slate-300 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-800 last:border-0">
                        {columns.map((col) => (
                          <td key={col} className="px-3 py-2 text-slate-400 whitespace-nowrap">
                            {row[col] != null && String(row[col]) !== "" ? String(row[col]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Select block types to import</h3>
                <p className="text-xs text-slate-500 mb-2">
                  Choose one or more block types. Each row will create one block per selected type. Map columns for each block below.
                </p>
                <div className="flex flex-wrap gap-4">
                  {availableBlocks.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlockTypes.includes(b.type)}
                        onChange={() => toggleBlockType(b.type)}
                        className="rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-slate-300">
                        {b.label} ({b.type})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Scenario name</h3>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Imported from Excel"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {selectedBlockTypes.map((blockType) => {
              const fieldConfigs = BLOCK_VALUE_FIELDS[blockType];
              const blockLabel = availableBlocks.find((b) => b.type === blockType)?.label ?? blockType;
              const mapping = columnToFieldByBlock[blockType] ?? {};
              return (
                <div key={blockType} className="rounded-lg border border-slate-700 p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Map columns to &quot;{blockLabel}&quot;</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Each row becomes one &quot;{blockLabel}&quot; block. Map Excel columns to the fields below.
                  </p>
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/80">
                          <th className="px-3 py-2 text-left font-medium text-slate-300">Excel column</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-300">Map to field</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((col) => (
                          <tr key={col} className="border-b border-slate-800 last:border-0">
                            <td className="px-3 py-2 text-slate-400 font-mono">{col}</td>
                            <td className="px-3 py-2">
                              <select
                                value={mapping[col] ?? ""}
                                onChange={(e) => setColumnMappingForBlock(blockType, col, e.target.value)}
                                className="w-full max-w-xs rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                              >
                                <option value="">Don&apos;t map</option>
                                {fieldConfigs.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} ({f.key})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreateScenario}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                Create scenario with {rows.length * selectedBlockTypes.length} block
                {rows.length * selectedBlockTypes.length !== 1 ? "s" : ""}
              </button>
              <Link
                href="/scenarios/builder"
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Open Scenario Builder
              </Link>
            </div>
          </>
        )}

        {status === "success" && (
          <div className="rounded-lg bg-green-900/30 border border-green-800 text-green-300 px-4 py-2 text-sm">
            Scenario &quot;{scenarioName.trim() || "Imported from Excel"}&quot; created. Open it from{" "}
            <Link href="/scenarios" className="underline hover:no-underline">
              Scenarios
            </Link>{" "}
            or the{" "}
            <Link href="/scenarios/builder" className="underline hover:no-underline">
              Scenario Builder
            </Link>
            .
          </div>
        )}
        {status === "error" && errorMessage && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 text-red-300 px-4 py-2 text-sm">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
