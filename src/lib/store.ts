import { create } from "zustand";

export type AppMode = "strategic" | "pmax" | "slides" | "creativo";

export type ChatMessage = {
  role: "user" | "model";
  content: string;
};

type HubState = {
  url: string;
  country: string;
  targetClient: string;
  strategicAnalysis: string | null;
  pmaxContent: string | null;
  slidesContent: string | null;
  chatStrategic: ChatMessage[];
  chatPmax: ChatMessage[];
  chatSlides: ChatMessage[];
  activeMode: AppMode;
  setUrl: (v: string) => void;
  setCountry: (v: string) => void;
  setTargetClient: (v: string) => void;
  setActiveMode: (m: AppMode) => void;
  setStrategicAnalysis: (v: string | null) => void;
  setPmaxContent: (v: string | null) => void;
  setSlidesContent: (v: string | null) => void;
  appendChat: (mode: AppMode, msg: ChatMessage) => void;
  resetAll: () => void;
};

const initial = {
  url: "",
  country: "",
  targetClient: "",
  strategicAnalysis: null as string | null,
  pmaxContent: null as string | null,
  slidesContent: null as string | null,
  chatStrategic: [] as ChatMessage[],
  chatPmax: [] as ChatMessage[],
  chatSlides: [] as ChatMessage[],
  activeMode: "strategic" as AppMode,
};

export const useHubStore = create<HubState>((set) => ({
  ...initial,
  setUrl: (v) => set({ url: v }),
  setCountry: (v) => set({ country: v }),
  setTargetClient: (v) => set({ targetClient: v }),
  setActiveMode: (m) => set({ activeMode: m }),
  setStrategicAnalysis: (v) => set({ strategicAnalysis: v }),
  setPmaxContent: (v) => set({ pmaxContent: v }),
  setSlidesContent: (v) => set({ slidesContent: v }),
  appendChat: (mode, msg) =>
    set((s) => {
      if (mode === "creativo") return s;
      if (mode === "strategic")
        return { chatStrategic: [...s.chatStrategic, msg] };
      if (mode === "pmax") return { chatPmax: [...s.chatPmax, msg] };
      return { chatSlides: [...s.chatSlides, msg] };
    }),
  resetAll: () => set({ ...initial }),
}));

export function getReportForMode(
  mode: AppMode,
  s: Pick<
    HubState,
    "strategicAnalysis" | "pmaxContent" | "slidesContent"
  >
): string | null {
  if (mode === "creativo") return null;
  if (mode === "strategic") return s.strategicAnalysis;
  if (mode === "pmax") return s.pmaxContent;
  return s.slidesContent;
}

export function getChatForMode(mode: AppMode, s: HubState): ChatMessage[] {
  if (mode === "creativo") return [];
  if (mode === "strategic") return s.chatStrategic;
  if (mode === "pmax") return s.chatPmax;
  return s.chatSlides;
}
