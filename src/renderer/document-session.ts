import type {
  DocumentSaveResult,
  VaultDocumentContent,
} from "../shared/contracts/vault";

export type DocumentSessionStatus =
  | "empty"
  | "clean"
  | "dirty"
  | "reconciling"
  | "saving"
  | "conflict"
  | "missing";

type PendingSave = {
  previousStatus: "conflict" | "dirty";
  requestId: number;
  submittedText: string;
};

export type DocumentSessionState = {
  base?: VaultDocumentContent;
  disk?: VaultDocumentContent;
  draft: string;
  generation: number;
  pendingSave?: PendingSave;
  status: DocumentSessionStatus;
};

export type DocumentSessionAction =
  | { document: VaultDocumentContent; type: "open" }
  | { type: "clear" }
  | { text: string; type: "edit" }
  | { type: "reconcile" }
  | { document: VaultDocumentContent; type: "reconcileClean" }
  | { disk: VaultDocumentContent; type: "conflict" }
  | { type: "missing" }
  | { requestId: number; submittedText: string; type: "saveStart" }
  | { requestId: number; result: DocumentSaveResult; type: "saveResult" }
  | { requestId: number; type: "saveFailed" };

export const emptyDocumentSession = (): DocumentSessionState => ({
  draft: "",
  generation: 0,
  status: "empty",
});

/**
 * The renderer's single source of truth for an open Markdown document.
 * `base` is the last disk version, `draft` is the exact source the user sees,
 * and `disk` is retained only while resolving a conflict. No reducer action
 * writes a vault file.
 */
export function documentSessionReducer(
  state: DocumentSessionState,
  action: DocumentSessionAction,
): DocumentSessionState {
  switch (action.type) {
    case "open":
      return {
        base: action.document,
        disk: undefined,
        draft: action.document.text,
        generation: state.generation + 1,
        status: "clean",
      };
    case "clear":
      return {
        ...emptyDocumentSession(),
        generation: state.generation + 1,
      };
    case "edit":
      return editDocumentSession(state, action.text);
    case "reconcile":
      return state.base &&
        state.status !== "missing" &&
        state.status !== "saving"
        ? { ...state, status: "reconciling" }
        : state;
    case "reconcileClean":
      if (!state.base) return state;
      if (state.status === "saving") return state;
      if (action.document.version === state.base.version) {
        if (state.status !== "reconciling") return state;
        return {
          ...state,
          status: state.draft === state.base.text ? "clean" : "dirty",
        };
      }
      if (state.draft === state.base.text) {
        return {
          ...state,
          base: action.document,
          disk: undefined,
          draft: action.document.text,
          generation: state.generation + 1,
          pendingSave: undefined,
          status: "clean",
        };
      }
      return {
        ...state,
        disk: action.document,
        pendingSave: undefined,
        status: "conflict",
      };
    case "conflict":
      return state.base
        ? {
            ...state,
            disk: action.disk,
            pendingSave: undefined,
            status: "conflict",
          }
        : state;
    case "missing":
      return state.base
        ? { ...state, pendingSave: undefined, status: "missing" }
        : state;
    case "saveStart":
      return state.base &&
        (state.status === "dirty" || state.status === "conflict")
        ? {
            ...state,
            pendingSave: {
              previousStatus: state.status,
              requestId: action.requestId,
              submittedText: action.submittedText,
            },
            status: "saving",
          }
        : state;
    case "saveResult":
      return applySaveResult(state, action.requestId, action.result);
    case "saveFailed":
      return restoreAfterFailedSave(state, action.requestId);
  }
}

function restoreAfterFailedSave(
  state: DocumentSessionState,
  requestId: number,
): DocumentSessionState {
  if (state.pendingSave?.requestId !== requestId || !state.base) return state;
  const status = state.pendingSave.previousStatus;
  return {
    ...state,
    pendingSave: undefined,
    status,
  };
}

function editDocumentSession(
  state: DocumentSessionState,
  text: string,
): DocumentSessionState {
  if (!state.base) return state;
  if (
    state.status === "conflict" ||
    state.status === "missing" ||
    state.status === "reconciling" ||
    state.status === "saving"
  ) {
    return { ...state, draft: text };
  }
  return {
    ...state,
    draft: text,
    status: text === state.base.text ? "clean" : "dirty",
  };
}

function applySaveResult(
  state: DocumentSessionState,
  requestId: number,
  result: DocumentSaveResult,
): DocumentSessionState {
  if (state.pendingSave?.requestId !== requestId || !state.base) return state;

  if (result.status === "saved") {
    return {
      ...state,
      base: result.document,
      disk: undefined,
      pendingSave: undefined,
      status:
        state.draft === state.pendingSave.submittedText ? "clean" : "dirty",
    };
  }
  if (result.status === "conflict") {
    return {
      ...state,
      disk: result.disk,
      pendingSave: undefined,
      status: "conflict",
    };
  }
  return {
    ...state,
    pendingSave: undefined,
    status: "missing",
  };
}
