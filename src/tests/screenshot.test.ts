import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zipSync, strToU8 } from "fflate";

import { extractZip } from "../lib/screenshot/zip.ts";
import { renderToCode } from "../lib/screenshot/renderer.ts";
import {
  ZIP_MAX_COMPRESSED_BYTES,
  FILE_MAX_UNCOMPRESSED_BYTES,
  ZIP_MAX_FILES,
} from "../lib/screenshot/constants.ts";

// ── ZIP extractor ──────────────────────────────────────────────────────────

describe("extractZip", () => {
  function makeZip(files: Record<string, string>): Buffer {
    const entries: Record<string, Uint8Array> = {};
    for (const [name, content] of Object.entries(files)) {
      entries[name] = strToU8(content);
    }
    return Buffer.from(zipSync(entries));
  }

  it("extracts a simple text file", () => {
    const buf = makeZip({ "hello.ts": 'console.log("hi");' });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
    assert.equal(files[0]!.filename, "hello.ts");
    assert.match(files[0]!.content, /console\.log/);
  });

  it("extracts multiple files", () => {
    const buf = makeZip({
      "a.ts": "const a = 1;",
      "b.ts": "const b = 2;",
      "c.ts": "const c = 3;",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 3);
  });

  it("skips node_modules entries", () => {
    const buf = makeZip({
      "src/index.ts": "export {};",
      "node_modules/lodash/lodash.js": "// lodash",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
    assert.equal(files[0]!.filename, "src/index.ts");
  });

  it("skips .git entries", () => {
    const buf = makeZip({
      "main.rs": "fn main() {}",
      ".git/config": "[core]",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
  });

  it("skips __MACOSX entries", () => {
    const buf = makeZip({
      "app.ts": "// code",
      "__MACOSX/._app.ts": "resource fork",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
    assert.equal(files[0]!.filename, "app.ts");
  });

  it("skips .DS_Store", () => {
    const buf = makeZip({
      "app.ts": "// code",
      ".DS_Store": "\x00\x00",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
  });

  it("skips binary extensions", () => {
    const buf = makeZip({
      "app.ts": "// code",
      "logo.png": "\x89PNG",
    });
    const files = extractZip(buf);
    assert.equal(files.length, 1);
  });

  it("expands tabs to spaces", () => {
    const buf = makeZip({ "file.ts": "\tconsole.log();" });
    const files = extractZip(buf);
    assert.match(files[0]!.content, /^    /);
  });

  it("rejects oversize compressed zip", () => {
    // Build a buffer bigger than 1 MB limit
    const buf = Buffer.alloc(ZIP_MAX_COMPRESSED_BYTES + 1, 0);
    assert.throws(() => extractZip(buf), /1 MB/);
  });

  it("rejects a file over the per-file limit", () => {
    const big = "a".repeat(FILE_MAX_UNCOMPRESSED_BYTES + 1);
    const buf = makeZip({ "big.ts": big });
    assert.throws(() => extractZip(buf), /100 KB/);
  });

  it("rejects more than ZIP_MAX_FILES files", () => {
    const files: Record<string, string> = {};
    for (let i = 0; i <= ZIP_MAX_FILES; i++) {
      files[`file${i}.ts`] = `// ${i}`;
    }
    const buf = makeZip(files);
    assert.throws(() => extractZip(buf), /25/);
  });

  it("throws when zip has no processable files", () => {
    const buf = makeZip({ "image.png": "\x89PNG" });
    assert.throws(() => extractZip(buf), /no processable/);
  });
});

// ── renderToCode ───────────────────────────────────────────────────────────

describe("renderToCode", () => {
  it("returns an object with a div type", () => {
    const node = renderToCode(
      [[{ color: "#fff", content: "const x = 1;" }]],
      1,
      "test.ts",
    ) as { type: string; props: { children: unknown[] } };

    assert.equal(node.type, "div");
    assert.ok(Array.isArray(node.props.children));
  });

  it("includes the filename in the header", () => {
    const node = renderToCode([], 1, "my-file.ts") as {
      props: { children: [{ props: { children: string } }] };
    };
    assert.equal(node.props.children[0]!.props.children, "my-file.ts");
  });

  it("produces correct line numbers with offset", () => {
    const node = renderToCode(
      [
        [{ color: "#fff", content: "line one" }],
        [{ color: "#fff", content: "line two" }],
      ],
      61,
      "part2.ts",
    ) as { props: { children: unknown[] } };

    // children[0] is the header, children[1..] are code rows
    const rows = node.props.children.slice(1) as {
      props: {
        children: [{ props: { children: string } }];
      };
    }[];
    assert.equal(rows[0]!.props.children[0]!.props.children, "61");
    assert.equal(rows[1]!.props.children[0]!.props.children, "62");
  });

  it("handles empty token rows", () => {
    const node = renderToCode([], 1, "empty.ts") as {
      props: { children: unknown[] };
    };
    // Header only, no code rows
    assert.equal(node.props.children.length, 1);
  });

  it("preserves token colors", () => {
    const node = renderToCode(
      [[{ color: "#ff0000", content: "red" }]],
      1,
      "colors.ts",
    ) as {
      props: {
        children: [
          unknown, // header
          {
            props: {
              children: [
                unknown, // line num
                {
                  props: {
                    children: [{ props: { style: { color: string } } }];
                  };
                },
              ];
            };
          },
        ];
      };
    };

    const tokenSpanContainer = node.props.children[1]!.props.children[1] as {
      props: { children: { props: { style: { color: string } } }[] };
    };
    assert.equal(
      tokenSpanContainer.props.children[0]!.props.style.color,
      "#ff0000",
    );
  });
});
