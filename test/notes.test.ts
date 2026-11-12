import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, filterByTag, formatList, NotesError, type Note } from "../src/notes.ts";

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

describe("tags", () => {
  it("stores normalized tags without duplicates", () => {
    const [n] = addNote([], "x", DAY, [" A ", "b", "a"]);
    expect(n.tags).toEqual(["a", "b"]);
  });

  it("does not create tags field without tags", () => {
    expect("tags" in addNote([], "x", DAY)[0]).toBe(false);
  });

  it("rejects empty tags", () => {
    expect(() => addNote([], "x", DAY, ["  "])).toThrow(NotesError);
  });

  it("filters by tag ignoring case", () => {
    const notes = addNote(addNote([], "a", DAY, ["work"]), "b", DAY);
    expect(filterByTag(notes, "WORK").map((n) => n.text)).toEqual(["a"]);
  });

  it("formats tags in a list", () => {
    const notes = addNote(addNote([], "milk", DAY, ["a", "b"]), "eggs", DAY);
    expect(formatList(notes)).toBe("1. milk (2026-11-06) [a, b]\n2. eggs (2026-11-06)");
  });
});

describe("cli tags", () => {
  it("adds with several tags, flag anywhere", () => {
    const file = tmpFile();
    run(["add", "--tag", "a", "--tag", "b", "texto"], file, DAY);
    run(["add", "otro", "--tag", "a"], file, DAY);
    expect(run(["list"], file, DAY).out).toBe("1. texto (2026-11-06) [a, b]\n2. otro (2026-11-06) [a]");
  });

  it("errors on --tag without value and saves nothing", () => {
    const file = tmpFile();
    expect(run(["add", "x", "--tag"], file, DAY).code).toBe(1);
    expect(run(["list"], file, DAY).out).toBe("No notes yet.");
  });

  it("filters list by tag", () => {
    const file = tmpFile();
    run(["add", "--tag", "a", "uno"], file, DAY);
    run(["add", "dos"], file, DAY);
    expect(run(["list", "--tag", "a"], file, DAY).out).toBe("1. uno (2026-11-06) [a]");
    expect(run(["list", "--tag", "zzz"], file, DAY).out).toBe("No notes yet.");
    expect(run(["list"], file, DAY).out).toContain("2. dos (2026-11-06)");
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
    expect(run(["fly"], tmpFile(), DAY).code).toBe(2);
  });
});
