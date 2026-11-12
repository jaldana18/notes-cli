import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { readFileSync } from "node:fs";
import { addNote, deleteNote, formatList, NotesError, searchNotes, type Note } from "../src/notes.ts";

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

  it("prints usage for unknown commands", () => {
    const res = run(["fly"], tmpFile(), DAY);
    expect(res.code).toBe(2);
    expect(res.out).toContain("search");
  });
});

const seeded = () => {
  const file = tmpFile();
  for (const t of ["buy milk", "call Bob", "Milkshake recipe"]) run(["add", t], file, DAY);
  return file;
};

describe("search", () => {
  const notes = ["milk", "buy Milk", "eggs"].reduce((acc, t) => addNote(acc, t, DAY), [] as Note[]);

  it("returns only matching notes, ignoring case", () => {
    expect(searchNotes(notes, "MILK").map((n) => n.text)).toEqual(["milk", "buy Milk"]);
    expect(searchNotes(notes, "eggs")).toHaveLength(1);
  });

  it("returns [] when nothing matches and keeps ids", () => {
    expect(searchNotes(notes, "zzz")).toEqual([]);
    expect(searchNotes(notes, "milk").map((n) => n.id)).toEqual([1, 2]);
  });

  it("refuses a blank query", () => {
    expect(() => searchNotes(notes, "   ")).toThrow(NotesError);
  });

  it("cli prints matching lines in list format", () => {
    expect(run(["search", "milk"], seeded(), DAY)).toEqual({
      code: 0,
      out: "1. buy milk (2026-11-06)\n3. Milkshake recipe (2026-11-06)",
    });
  });

  it("cli prints a message when nothing matches", () => {
    expect(run(["search", "zzz"], seeded(), DAY)).toEqual({ code: 0, out: "No matching notes." });
  });

  it("cli joins multi-word queries", () => {
    expect(run(["search", "buy", "milk"], seeded(), DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("cli errors without text", () => {
    const res = run(["search"], seeded(), DAY);
    expect(res.code).toBe(1);
    expect(res.out).toContain("error:");
  });

  it("cli does not modify the file", () => {
    const file = seeded();
    const before = readFileSync(file, "utf8");
    run(["search", "milk"], file, DAY);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
