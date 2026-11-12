import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, formatList, formatSearch, NotesError, searchNotes, type Note } from "../src/notes.ts";

const DAY = "2026-11-06";
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");

describe("notes", () => {
  it("adds a note with the next id", () => {
    const notes = addNote(addNote([], "first", DAY), "second", DAY);
    expect(notes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("trims text and refuses empty notes", () => {
    expect(addNote([], "  hi  ", DAY)[0].text).toBe("hi");
    expect(() => addNote([], "   ", DAY)).toThrow(NotesError);
  });

  it("deletes by id and refuses unknown ids", () => {
    const notes: Note[] = addNote([], "a", DAY);
    expect(deleteNote(notes, 1)).toEqual([]);
    expect(() => deleteNote(notes, 9)).toThrow("no note with id 9");
  });

  it("formats a list", () => {
    expect(formatList([])).toBe("No notes yet.");
    expect(formatList(addNote([], "milk", DAY))).toBe("1. milk (2026-11-06)");
  });

  const sample = (): Note[] => addNote(addNote(addNote([], "buy milk", DAY), "call mom", DAY), "milkshake", DAY);

  it("searches notes whose text contains the query", () => {
    expect(searchNotes(sample(), "milk").map((n) => n.id)).toEqual([1, 3]);
  });

  it("searches ignoring case", () => {
    expect(searchNotes(addNote([], "buy milk", DAY), "MILK").map((n) => n.id)).toEqual([1]);
    expect(searchNotes(addNote([], "Buy MILK", DAY), "milk").map((n) => n.id)).toEqual([1]);
  });

  it("returns no notes when nothing matches", () => {
    expect(searchNotes(sample(), "bread")).toEqual([]);
  });

  it("refuses an empty search", () => {
    expect(() => searchNotes(sample(), "")).toThrow(NotesError);
    expect(() => searchNotes(sample(), "   ")).toThrow(NotesError);
  });

  it("formats search results", () => {
    expect(formatSearch([])).toBe("No matching notes.");
    expect(formatSearch(addNote([], "milk", DAY))).toBe("1. milk (2026-11-06)");
  });
});

describe("cli", () => {
  it("adds and lists notes in the file", () => {
    const file = tmpFile();
    expect(run(["add", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("deletes a note", () => {
    const file = tmpFile();
    run(["add", "x"], file, DAY);
    expect(run(["delete", "1"], file, DAY).code).toBe(0);
    expect(run(["list"], file, DAY).out).toBe("No notes yet.");
  });

  it("reports errors with exit code 1", () => {
    const file = tmpFile();
    writeFileSync(file, "{ not json");
    expect(run(["list"], file, DAY).code).toBe(1);
    expect(run(["delete", "3"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: no note with id 3" });
  });

  it("searches notes case-insensitively", () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "call", "mom"], file, DAY);
    expect(run(["search", "MILK"], file, DAY)).toEqual({ code: 0, out: "1. buy milk (2026-11-06)" });
  });

  it("searches with a multi-word query", () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "milk", "buy"], file, DAY);
    expect(run(["search", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "1. buy milk (2026-11-06)" });
  });

  it("reports when no notes match", () => {
    const file = tmpFile();
    run(["add", "call", "mom"], file, DAY);
    expect(run(["search", "milk"], file, DAY)).toEqual({ code: 0, out: "No matching notes." });
    expect(run(["search", "milk"], tmpFile(), DAY)).toEqual({ code: 0, out: "No matching notes." });
  });

  it("refuses an empty search with exit code 1", () => {
    expect(run(["search"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: a search needs some text" });
  });

  it("does not change the file when searching", () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "call", "mom"], file, DAY);
    const before = run(["list"], file, DAY).out;
    run(["search", "milk"], file, DAY);
    expect(run(["list"], file, DAY).out).toBe(before);
  });

  it("prints usage for unknown commands", () => {
    expect(run(["fly"], tmpFile(), DAY).code).toBe(2);
  });
});
