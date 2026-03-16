"use client";

import type { ReactNode } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

type Props = { children: ReactNode };

export function AuthGuard({ children }: Props) {
  const { accounts, instance, inProgress } = useMsal();
  const isAuthenticated = accounts.length > 0;
  const isLoginInProgress =
    inProgress === InteractionStatus.Login ||
    inProgress === InteractionStatus.Startup;

  const handleLogin = () => {
    instance.loginRedirect({ scopes: ["User.Read"] }).catch(console.error);
  };

  if (isLoginInProgress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--app-bg,#020617)]">
        <p className="text-slate-400">Signing in...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[var(--app-bg,#020617)] px-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold" style={{ color: "#d4af37" }}>
            Value Navigator
          </h1>
          <p className="text-slate-400 text-sm">Sign in with your work account to continue.</p>
        </div>
        <button
          type="button"
          onClick={handleLogin}
          className="rounded-lg bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
