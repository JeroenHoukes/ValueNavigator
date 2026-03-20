"use client";

import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "../config/msalConfig";
import { AuthGuard } from "@/components/AuthGuard";
import { BackgroundColorPicker } from "@/components/BackgroundColorPicker";
import { AIAssistantButton, AIAssistantPanel } from "@/components/AIAssistant";
import { AppActionsProvider } from "@/contexts/AppActionsContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { VoiceInputButton } from "@/components/VoiceInputButton";

const pca = new PublicClientApplication(msalConfig);

const createNewItems = [
  { href: "/scenarios/builder", label: "Scenario Builder" },
  { href: "/journey", label: "Customer journey" },
  { href: "/scenarios/import", label: "Import Excel" }
] as const;

const overviewItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/gantt", label: "Gantt" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/journeys", label: "Journeys" },
  { href: "/ai-data", label: "AI Data" },
  { href: "/ai-data2", label: "AI Data 2" },
  { href: "/milestone", label: "Milestones" }
] as const;

function isCreateNewActive(pathname: string) {
  return (
    pathname === "/journey" ||
    pathname === "/scenarios/import" ||
    pathname === "/scenarios/builder" ||
    pathname.startsWith("/scenarios/builder")
  );
}

function isOverviewActive(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/gantt" ||
    pathname === "/scenarios" ||
    pathname === "/ai-data" ||
    pathname === "/ai-data2" ||
    pathname === "/milestone" ||
    pathname === "/journeys" ||
    pathname === "/journey" ||
    (pathname.startsWith("/scenarios/") &&
      !pathname.startsWith("/scenarios/builder") &&
      !pathname.startsWith("/scenarios/wizard") &&
      !pathname.startsWith("/scenarios/import"))
  );
}

function HeaderAndMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { accounts, instance } = useMsal();
  const [aiOpen, setAiOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<"create" | "overview" | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const user = accounts[0];
  const handleLogout = () => instance.logoutRedirect().catch(console.error);

  useEffect(() => {
    if (openMenu === null) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenu]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90">
            <span className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold">
              VN
            </span>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: "#d4af37" }}>Value Navigator</h1>
              <p className="text-xs text-slate-400">
                Make. Better. Decisions.
              </p>
            </div>
          </Link>
          <nav ref={navRef} className="flex items-center gap-1 relative" aria-label="Main navigation">
            <Link
              href="/"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              Home
            </Link>
            <Link
              href="/user-guide"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/user-guide"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              User guide
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu((m) => (m === "create" ? null : "create"));
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isCreateNewActive(pathname)
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                }`}
                aria-expanded={openMenu === "create"}
                aria-haspopup="true"
              >
                Create new
                <span className="text-slate-500" aria-hidden>{openMenu === "create" ? " ▲" : " ▼"}</span>
              </button>
              {openMenu === "create" && (
                <ul
                  className="absolute left-0 top-full mt-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-50"
                  role="menu"
                >
                  {createNewItems.map(({ href, label }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <li key={href} role="none">
                        <Link
                          href={href}
                          role="menuitem"
                          onClick={() => setOpenMenu(null)}
                          className={`block px-3 py-2 text-sm transition-colors ${
                            isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700/70 hover:text-white"
                          }`}
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu((m) => (m === "overview" ? null : "overview"));
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isOverviewActive(pathname)
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                }`}
                aria-expanded={openMenu === "overview"}
                aria-haspopup="true"
              >
                Overview
                <span className="text-slate-500" aria-hidden>{openMenu === "overview" ? " ▲" : " ▼"}</span>
              </button>
              {openMenu === "overview" && (
                <ul
                  className="absolute left-0 top-full mt-1 min-w-[160px] rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-50"
                  role="menu"
                >
                  {overviewItems.map(({ href, label }) => {
                    const isActive =
                      pathname === href ||
                      (href === "/scenarios" && pathname.startsWith("/scenarios/") && !pathname.startsWith("/scenarios/builder") && !pathname.startsWith("/scenarios/wizard") && !pathname.startsWith("/scenarios/import")) ||
                      (href === "/journeys" && pathname === "/journey");
                    return (
                      <li key={href} role="none">
                        <Link
                          href={href}
                          role="menuitem"
                          onClick={() => setOpenMenu(null)}
                          className={`block px-3 py-2 text-sm transition-colors ${
                            isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700/70 hover:text-white"
                          }`}
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </nav>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-xs text-slate-400 max-w-[120px] truncate" title={user.username}>
                {user.name ?? user.username}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/70"
            >
              Sign out
            </button>
            <VoiceInputButton />
            <AIAssistantButton open={aiOpen} setOpen={setAiOpen} />
            <BackgroundColorPicker />
          </div>
        </header>
        <div className="flex flex-1 min-h-0 overflow-hidden" style={{ minHeight: 0, maxHeight: "calc(100vh - 4rem)" }}>
          {aiOpen && (
            <AIAssistantPanel onClose={() => setAiOpen(false)} />
          )}
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4 max-w-6xl mx-auto w-full" style={{ minHeight: 0 }}>
            {children}
          </main>
        </div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={pca}>
      <AuthGuard>
        <AppContent>{children}</AppContent>
      </AuthGuard>
    </MsalProvider>
  );
}

function AppContent({ children }: { children: ReactNode }) {
  return (
    <AppActionsProvider>
      <VoiceProvider>
        <HeaderAndMain>{children}</HeaderAndMain>
      </VoiceProvider>
    </AppActionsProvider>
  );
}
