import { describe, expect, it } from "vitest";

import {
  documentSessionReducer,
  emptyDocumentSession,
} from "./document-session";

const note = (text: string, version = "one") => ({
  kind: "markdown" as const,
  relativePath: "notes/idea.md",
  text,
  title: "idea",
  version,
});

describe("documentSessionReducer", () => {
  it("keeps a dirty draft and exact disk revision when an external change arrives", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\r\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\r\n", type: "edit" });
    state = documentSessionReducer(state, { type: "reconcile" });
    state = documentSessionReducer(state, {
      document: note("# Disk\r\n", "two"),
      type: "reconcileClean",
    });

    expect(state).toMatchObject({
      base: expect.objectContaining({ text: "# Before\r\n" }),
      disk: expect.objectContaining({ text: "# Disk\r\n", version: "two" }),
      draft: "# Mine\r\n",
      status: "conflict",
    });
  });

  it("does not reset the editor generation for its own completed save", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n", "one"),
      type: "open",
    });
    const generation = state.generation;
    state = documentSessionReducer(state, { type: "reconcile" });
    state = documentSessionReducer(state, {
      document: note("# Before\n", "one"),
      type: "reconcileClean",
    });

    expect(state).toMatchObject({ generation, status: "clean" });
  });

  it("returns to dirty after a watcher scan that did not alter the open file", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n", "one"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, { type: "reconcile" });
    state = documentSessionReducer(state, {
      document: note("# Before\n", "one"),
      type: "reconcileClean",
    });

    expect(state).toMatchObject({ draft: "# Mine\n", status: "dirty" });
  });

  it("does not replace typing that happened while a save was in flight", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# First\n", type: "edit" });
    state = documentSessionReducer(state, {
      requestId: 4,
      submittedText: "# First\n",
      type: "saveStart",
    });
    state = documentSessionReducer(state, {
      text: "# Newer typing\n",
      type: "edit",
    });
    state = documentSessionReducer(state, {
      requestId: 4,
      result: { document: note("# First\n", "two"), status: "saved" },
      type: "saveResult",
    });

    expect(state).toMatchObject({
      base: expect.objectContaining({ version: "two" }),
      draft: "# Newer typing\n",
      status: "dirty",
    });
  });

  it("returns a rejected autosave to a saveable dirty state", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, {
      requestId: 4,
      submittedText: "# Mine\n",
      type: "saveStart",
    });
    state = documentSessionReducer(state, { type: "saveFailed", requestId: 4 });

    expect(state).toMatchObject({
      draft: "# Mine\n",
      pendingSave: undefined,
      status: "dirty",
    });
  });

  it("does not let watcher reconciliation interrupt an in-flight save", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, {
      requestId: 4,
      submittedText: "# Mine\n",
      type: "saveStart",
    });
    state = documentSessionReducer(state, { type: "reconcile" });
    state = documentSessionReducer(state, {
      document: note("# Before\n"),
      type: "reconcileClean",
    });

    expect(state).toMatchObject({
      pendingSave: expect.objectContaining({ requestId: 4 }),
      status: "saving",
    });
  });

  it("restores a conflict when a Keep Mine request fails operationally", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, {
      document: note("# Disk\n", "two"),
      type: "reconcileClean",
    });
    state = documentSessionReducer(state, {
      requestId: 5,
      submittedText: "# Mine\n",
      type: "saveStart",
    });
    state = documentSessionReducer(state, { type: "saveFailed", requestId: 5 });

    expect(state).toMatchObject({
      disk: expect.objectContaining({ version: "two" }),
      status: "conflict",
    });
  });

  it("ignores a stale save result after a newer document was opened", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, {
      requestId: 1,
      submittedText: "# Mine\n",
      type: "saveStart",
    });
    state = documentSessionReducer(state, {
      document: note("# Different\n", "different"),
      type: "open",
    });
    state = documentSessionReducer(state, {
      requestId: 1,
      result: { document: note("# Mine\n", "two"), status: "saved" },
      type: "saveResult",
    });

    expect(state).toMatchObject({
      base: expect.objectContaining({
        text: "# Different\n",
        version: "different",
      }),
      draft: "# Different\n",
      status: "clean",
    });
  });

  it("keeps a missing document buffer recoverable", () => {
    let state = documentSessionReducer(emptyDocumentSession(), {
      document: note("# Before\n"),
      type: "open",
    });
    state = documentSessionReducer(state, { text: "# Mine\n", type: "edit" });
    state = documentSessionReducer(state, { type: "missing" });

    expect(state).toMatchObject({
      base: expect.objectContaining({ text: "# Before\n" }),
      draft: "# Mine\n",
      status: "missing",
    });
  });
});
