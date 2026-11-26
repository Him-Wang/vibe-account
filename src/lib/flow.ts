import type { FlowState } from "../types";

let flow: FlowState = {
  mode: "receipt",
  imagePaths: [],
  builtin: null,
  ocr: null,
  segment: null,
  anime: null,
};

export function getFlow(): FlowState {
  return flow;
}

export function setFlow(patch: Partial<FlowState>): void {
  flow = { ...flow, ...patch };
}

export function resetFlow(): void {
  flow = {
    mode: "receipt",
    imagePaths: [],
    builtin: null,
    ocr: null,
    segment: null,
    anime: null,
  };
}
