"use client";

import { createContext, useCallback, useRef, useContext, type ReactNode } from "react";
import { loadJourneys, saveJourneys, createStep, type SavedJourney } from "@/lib/journeyConfig";

export type ExecutePayload =
  | { type: "journey.addStep"; name: string; volume?: number };

export interface JourneyActions {
  addStep(name: string, volume?: number): void;
}

export interface AppActionsContextValue {
  registerJourneyActions(actions: JourneyActions): void;
  unregisterJourneyActions(): void;
  execute(payload: ExecutePayload): Promise<{ success: boolean; message: string }>;
}

const noop = () => {};

const defaultContext: AppActionsContextValue = {
  registerJourneyActions: noop,
  unregisterJourneyActions: noop,
  execute: async () => ({ success: false, message: "No actions registered." })
};

export const AppActionsContext = createContext<AppActionsContextValue>(defaultContext);

export function useAppActions(): AppActionsContextValue {
  return useContext(AppActionsContext);
}

export function AppActionsProvider({ children }: { children: ReactNode }) {
  const journeyActionsRef = useRef<JourneyActions | null>(null);

  const registerJourneyActions = useCallback((actions: JourneyActions) => {
    journeyActionsRef.current = actions;
  }, []);

  const unregisterJourneyActions = useCallback(() => {
    journeyActionsRef.current = null;
  }, []);

  const execute = useCallback(async (payload: ExecutePayload): Promise<{ success: boolean; message: string }> => {
    if (payload.type === "journey.addStep") {
      const { name, volume } = payload;
      const actions = journeyActionsRef.current;
      if (actions) {
        try {
          actions.addStep(name, volume);
          return {
            success: true,
            message: volume != null
              ? `Added step "${name}" with volume ${volume}.`
              : `Added step "${name}".`
          };
        } catch (e) {
          return {
            success: false,
            message: e instanceof Error ? e.message : "Failed to add step."
          };
        }
      }
      // No journey page mounted: update localStorage (first journey or create new)
      try {
        const list = loadJourneys();
        const journey: SavedJourney = list.length > 0
          ? list[0]
          : {
              id: crypto.randomUUID(),
              name: "My customer journey",
              steps: [],
              savedAt: new Date().toISOString()
            };
        const step = createStep(name, journey.steps.length, { volume });
        journey.steps = [...journey.steps, step];
        journey.savedAt = new Date().toISOString();
        const idx = list.findIndex((j) => j.id === journey.id);
        if (idx >= 0) list[idx] = journey;
        else list.unshift(journey);
        saveJourneys(list);
        return {
          success: true,
          message: `Added step "${name}"${volume != null ? ` with volume ${volume}` : ""}. Open Customer journey to see it.`
        };
      } catch (e) {
        return {
          success: false,
          message: e instanceof Error ? e.message : "Failed to add step."
        };
      }
    }
    return { success: false, message: "Unknown action." };
  }, []);

  const value: AppActionsContextValue = {
    registerJourneyActions,
    unregisterJourneyActions,
    execute
  };

  return (
    <AppActionsContext.Provider value={value}>
      {children}
    </AppActionsContext.Provider>
  );
}
