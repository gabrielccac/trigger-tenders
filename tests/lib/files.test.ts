import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { unrar, unzip } from "../../src/lib/files";

describe("unrar", () => {
  it("extracts files from Deep.rar", async () => {
    const buf = await readFile(join("fixtures", "Deep.rar"));
    const files = await unrar(buf);
    expect(files.length).toBeGreaterThan(0);
    console.log(
      "Extracted files:",
      files.map((f) => ({ name: f.name, size: f.buffer.length }))
    );
  });

  it("returns only leaf (non-rar) files", async () => {
    const buf = await readFile(join("fixtures", "Deep.rar"));
    const files = await unrar(buf);
    const rarFiles = files.filter((f) =>
      f.name.toLowerCase().endsWith(".rar")
    );
    expect(rarFiles).toHaveLength(0);
  });
});
