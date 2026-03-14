"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ExecutePayload } from "@/contexts/AppActionsContext";
import { useAppActions } from "@/contexts/AppActionsContext";
import { useVoice } from "@/contexts/VoiceContext";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: { label: string; href: string }[];
}

export interface HelpResponse {
  text: string;
  actions: { label: string; href: string }[];
  execute?: ExecutePayload;
}

function parseJourneyStepRequest(q: string): { name: string; volume?: number } | null {
  if (!/(?:create|add)\s+(?:a\s+)?(?:customer\s+)?journey\s+step/i.test(q)) return null;
  let name = "";
  let volume: number | undefined;
  const namedMatch = q.match(/(?:named?\s+|called\s+)["']?([^"',.]+?)["']?(?:\s+with\s+volume|\s*$|,|\.)/i)
    || q.match(/(?:named?\s+|called\s+)["']?([^"']+)["']/i);
  if (namedMatch) name = namedMatch[1].trim();
  const volMatch = q.match(/volume\s+(\d+(?:\.\d+)?)/i);
  if (volMatch) volume = Number(volMatch[1]);
  if (!name && volMatch) {
    const beforeVolume = q.substring(0, q.indexOf(volMatch[0])).trim();
    const afterStep = beforeVolume.replace(/^(?:create|add)\s+(?:a\s+)?(?:customer\s+)?journey\s+steps?\s+/i, "").trim();
    const named = afterStep.match(/(?:named?\s+|called\s+)["']?([^"']+)["']?/i);
    if (named) name = named[1].trim();
    else if (afterStep.length > 0 && !/^\d+$/.test(afterStep)) name = afterStep.replace(/\s+with\s*$/i, "").trim();
  }
  if (!name) {
    const quoted = q.match(/["']([^"']+)["']/);
    if (quoted) name = quoted[1].trim();
  }
  if (!name) return null;
  return { name, volume };
}

function getHelpResponse(userMessage: string, pathname: string): HelpResponse {
  const q = userMessage.toLowerCase().trim();
  const actions: { label: string; href: string }[] = [];

  if (q.length === 0) {
    return {
      text: "I can help you use Value Navigator. Ask things like: \"How do I add a scenario?\", \"Create a customer journey step named Onboarding with volume 5000\", or \"Open the Gantt chart\".",
      actions: [
        { label: "Open Scenario Builder", href: "/scenarios/builder" },
        { label: "Open Gantt", href: "/gantt" },
        { label: "Import Excel", href: "/scenarios/import" },
        { label: "Customer journey", href: "/journey" }
      ]
    };
  }

  if (/create|add/i.test(q) && /journey\s+step|customer\s+journey\s+step/i.test(q)) {
    const journeyStep = parseJourneyStepRequest(userMessage);
    if (journeyStep) {
      return {
        text: `Creating customer journey step "${journeyStep.name}"${journeyStep.volume != null ? ` with volume ${journeyStep.volume}` : ""}.`,
        actions: [{ label: "Open Customer journey", href: "/journey" }],
        execute: { type: "journey.addStep", name: journeyStep.name, volume: journeyStep.volume }
      };
    }
    return {
      text: "To create a customer journey step, include the name and volume. For example: \"Create a customer journey step named Onboarding with volume 5000\" or \"Add a journey step called Sign-up with volume 1200\".",
      actions: [{ label: "Open Customer journey", href: "/journey" }]
    };
  }

  const navPatterns: { pattern: RegExp; href: string; label: string }[] = [
    { pattern: /gantt|milestone|timeline/, href: "/gantt", label: "Open Gantt" },
    { pattern: /scenario builder|building block|pipeline|add block/, href: "/scenarios/builder", label: "Open Scenario Builder" },
    { pattern: /import excel|upload excel|xlsx|import.*excel/, href: "/scenarios/import", label: "Import Excel" },
    { pattern: /customer journey|journey/, href: "/journey", label: "Customer journey" },
    { pattern: /scenarios list|saved scenario|my scenario/, href: "/scenarios", label: "Scenarios" },
    { pattern: /wizard|step.*scenario/, href: "/scenarios/wizard", label: "Scenario wizard" },
    { pattern: /dashboard|home/, href: "/dashboard", label: "Dashboard" }
  ];

  for (const { pattern, href, label } of navPatterns) {
    if (pattern.test(q) && !actions.some((a) => a.href === href)) {
      actions.push({ label, href });
    }
  }

  if (/\b(go|open|take me|navigate|show me)\b.*(gantt|milestone|timeline)/i.test(q)) {
    return {
      text: "Opening the Gantt chart. There you can add scenarios as initiatives and set start date and duration (weeks) to see bars on the timeline.",
      actions: [{ label: "Open Gantt", href: "/gantt" }]
    };
  }
  if (/\b(go|open|take me|navigate|show me)\b.*(scenario builder|builder|pipeline|block)/i.test(q)) {
    return {
      text: "Opening the Scenario Builder. Drag building blocks from the left into the pipeline, then expand each block to enter values (e.g. Revenue growth %, Capex amount and year).",
      actions: [{ label: "Open Scenario Builder", href: "/scenarios/builder" }]
    };
  }
  if (/\b(go|open|take me|import)\b.*(excel|xlsx)/i.test(q)) {
    return {
      text: "Opening Import Excel. Upload an .xlsx file, choose the block type (e.g. Capex), then map each column to a field (e.g. investments → Capex €M, year → Year). Each row becomes one block in a new scenario.",
      actions: [{ label: "Import Excel", href: "/scenarios/import" }]
    };
  }
  if (/\b(go|open|take me)\b.*(journey|customer)/i.test(q)) {
    return {
      text: "Opening Customer journey. Add steps and set volume, revenue, costs, and other metrics. You can link a step's volume to a proportion of another step.",
      actions: [{ label: "Customer journey", href: "/journey" }]
    };
  }

  if (/how.*(add|create).*scenario|add.*scenario|create.*scenario/i.test(q)) {
    return {
      text: "To add a scenario: 1) Open Scenario Builder, 2) Drag building blocks (Revenue, Costs, Capex, etc.) into the pipeline, 3) Expand each block and fill the values, 4) Enter a scenario name and click Save. You can also use the Scenario wizard for a guided flow, or Import Excel to create a scenario from a spreadsheet.",
      actions: [
        { label: "Scenario Builder", href: "/scenarios/builder" },
        { label: "Scenario wizard", href: "/scenarios/wizard" },
        { label: "Import Excel", href: "/scenarios/import" }
      ]
    };
  }
  if (/how.*import|import.*excel|upload.*excel|excel.*map/i.test(q)) {
    return {
      text: "Go to Import Excel, choose your .xlsx file, then select the block type (e.g. Capex). Map each Excel column to a field: e.g. map 'investments' to Capex (€M) and 'year' to Year. Each row in the sheet becomes one block. Click 'Create scenario with N blocks' to save.",
      actions: [{ label: "Import Excel", href: "/scenarios/import" }]
    };
  }
  if (/capex|investment|investments|cap ex/i.test(q) && /how|add|enter|data/i.test(q)) {
    return {
      text: "Capex (Investments) is a building block with two fields: Capex (€M) and Year. In Scenario Builder, drag 'Capex' into the pipeline, expand it, and enter the amount and year. For multiple capex entries (e.g. year 1, 2, 3), add multiple Capex blocks or use Import Excel and map your columns to Capex (€M) and Year.",
      actions: [
        { label: "Scenario Builder", href: "/scenarios/builder" },
        { label: "Import Excel", href: "/scenarios/import" }
      ]
    };
  }
  if (/building block|block type|revenue|costs|risk|satisfaction|happiness/i.test(q) && /what|which|list|explain/i.test(q)) {
    return {
      text: "Building blocks in Scenario Builder: Revenue (Growth %, Base amount €M), Costs (Amount €M, Growth %), Capex/Investments (Capex €M, Year), Risks (Adjustment %, Note), User Satisfaction (score %, Target %, Growth impact %), Employee Happiness (score %, Note, Growth impact %). Drag them into the pipeline and fill the values.",
      actions: [{ label: "Scenario Builder", href: "/scenarios/builder" }]
    };
  }
  if (/gantt|milestone|timeline/i.test(q) && /how|use|work/i.test(q)) {
    return {
      text: "On the Gantt page you add initiatives (your saved scenarios). Use 'Add to Gantt' to pick a scenario, then set Start date, Weeks (duration), and Horizon (years) for each row. The bar shows on the timeline. You can zoom with +/−. Vertical lines mark year boundaries.",
      actions: [{ label: "Open Gantt", href: "/gantt" }]
    };
  }
  if (/journey|customer journey/i.test(q) && /how|step|volume|proportion/i.test(q)) {
    return {
      text: "Customer journey lets you define steps with volume, revenue, costs, growth %, satisfaction %, capex, risk %. You can set a step's volume as a proportion of an earlier step. Reorder steps by drag and drop. Save journeys from the page.",
      actions: [{ label: "Customer journey", href: "/journey" }]
    };
  }
  if (/help|what can you do|how do i/i.test(q)) {
    return {
      text: "I can guide you through Value Navigator. You can ask: how to add or create a scenario, how to import Excel and map to Capex/year, what building blocks exist, how to use the Gantt or customer journey. You can also say 'Open Scenario Builder' or 'Go to Gantt' and I'll give you a link to get there.",
      actions: [
        { label: "Scenario Builder", href: "/scenarios/builder" },
        { label: "Gantt", href: "/gantt" },
        { label: "Import Excel", href: "/scenarios/import" }
      ]
    };
  }

  return {
    text: "I'm not sure about that. Try: \"How do I add a scenario?\", \"How do I import Excel to Capex?\", \"Open Scenario Builder\", or \"What building blocks are there?\" I can open pages for you and explain data entry.",
    actions: actions.length > 0 ? actions : [
      { label: "Scenario Builder", href: "/scenarios/builder" },
      { label: "Gantt", href: "/gantt" },
      { label: "Import Excel", href: "/scenarios/import" }
    ]
  };
}

/** Header button to toggle the AI left pane */
export function AIAssistantButton({
  open,
  setOpen
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        open ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white hover:bg-slate-800/70"
      }`}
      title="AI assistant – ask how to use the app"
      aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      aria-expanded={open}
    >
      <span className="text-lg" aria-hidden>✨</span>
      <span className="hidden sm:inline">AI</span>
    </button>
  );
}

/** Left-pane chat panel: results and actions (navigate in right pane) */
export function AIAssistantPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content: "Hi! I can help you use Value Navigator. You can ask me to do things — for example: \"Create a customer journey step named Onboarding with volume 5000\" — or ask how to use a page. Use the buttons to open a page on the right.",
      actions: [
        { label: "Open Scenario Builder", href: "/scenarios/builder" },
        { label: "Open Gantt", href: "/gantt" },
        { label: "Import Excel", href: "/scenarios/import" },
        { label: "Customer journey", href: "/journey" }
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { execute: runExecute } = useAppActions();
  const { transcript, clearTranscript } = useVoice();

  useEffect(() => {
    if (transcript.trim()) {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).trim());
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages]);

  // Group into (prompt, answer) pairs; reverse so latest is on top. Each block: prompt on top, answer below.
  const pairs: { user: ChatMessage | null; assistant: ChatMessage }[] = [];
  let i = 0;
  if (messages.length > 0 && messages[0].role === "assistant") {
    pairs.push({ user: null, assistant: messages[0] });
    i = 1;
  }
  while (i + 1 < messages.length) {
    if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
      pairs.push({ user: messages[i], assistant: messages[i + 1] });
      i += 2;
    } else {
      i += 1;
    }
  }
  const reversedPairs = [...pairs].reverse();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    (async () => {
      try {
        const res = getHelpResponse(text, pathname ?? "");
        if (res.execute) {
          const result = await runExecute(res.execute);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: result.success ? result.message : `Couldn't complete: ${result.message}`,
              actions: res.actions
            }
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.text,
              actions: res.actions
            }
          ]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }

  function handleActionClick(href: string) {
    router.push(href);
  }

  return (
    <aside
      className="w-full sm:w-[380px] shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/95"
      style={{ minHeight: 0, height: "100%" }}
      role="complementary"
      aria-label="AI assistant"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <h2 className="font-semibold text-white">AI assistant</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close AI pane"
        >
          ×
        </button>
      </div>
      <form onSubmit={handleSubmit} className="px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or request an action…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
        <div
          ref={scrollRef}
          className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-4"
          style={{ minHeight: 0 }}
        >
        {reversedPairs.map((pair, idx) => (
          <div key={idx} className="flex flex-col gap-2 w-full space-y-2">
            {pair.user && (
              <div className="flex flex-col gap-2 w-full items-end">
                <div className="rounded-xl px-4 py-2.5 max-w-[95%] text-sm bg-brand text-white">
                  {pair.user.content}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full items-start">
              <div className="rounded-xl px-4 py-2.5 max-w-[95%] text-sm bg-slate-800 text-slate-200">
                {pair.assistant.content}
              </div>
              {pair.assistant.actions && pair.assistant.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 w-full max-w-[95%]">
                  {pair.assistant.actions.map((a) => (
                    <button
                      key={a.href + a.label}
                      type="button"
                      onClick={() => handleActionClick(a.href)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-brand"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-slate-400">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
