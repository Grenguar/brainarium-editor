import type { BrainariumApi } from "../preload";

declare global {
  interface Window {
    brainarium: BrainariumApi;
  }
}

export {};
