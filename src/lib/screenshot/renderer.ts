import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createHighlighter, type ThemedToken, type Highlighter } from "shiki";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { CodeFile, ScreenshotResult } from "./types.ts";
import { LINES_PER_SLICE, MAX_LINES, RENDER_SCALE } from "./constants.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(
  __dirname,
  "../../../assets/fonts/JetBrainsMono-Regular.ttf",
);

// Lazily initialised singletons
let fontData: Buffer | null = null;
let cachedHighlighter: Highlighter | null = null;

async function getFont(): Promise<Buffer> {
  if (!fontData) fontData = await readFile(FONT_PATH);
  return fontData;
}

async function getHighlighter(lang: string): Promise<Highlighter> {
  if (!cachedHighlighter) {
    cachedHighlighter = await createHighlighter({
      themes: ["github-dark-dimmed"],
      langs: [lang],
    });
  } else {
    const loaded = cachedHighlighter.getLoadedLanguages();
    if (!loaded.includes(lang)) {
      await cachedHighlighter.loadLanguage(
        lang as Parameters<Highlighter["loadLanguage"]>[0],
      );
    }
  }
  return cachedHighlighter;
}

// Theme colours (GitHub Dark Dimmed)
const BG = "#22272e";
const FG = "#adbac7";
const LINE_NUM_COLOR = "#545d68";
const FONT_SIZE = 16;
const LINE_HEIGHT = FONT_SIZE * 1.6;
const CHAR_WIDTH = FONT_SIZE * 0.6; // monospace character width at this font size
const GUTTER_WIDTH = 32 + 16; // minWidth of line-number gutter + marginRight
const PADDING_X = 20 * 2; // left + right padding
const MIN_WIDTH = 300; // minimum image width

interface TokenInfo {
  color: string;
  content: string;
}

/**
 * renderToCode — converts highlighted token rows into a Satori VDOM node.
 * Exported so you can call it directly for debugging without Discord plumbing.
 */
export function renderToCode(
  tokenRows: TokenInfo[][],
  startLine: number,
  filename: string,
): Record<string, unknown> {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        background: BG,
        padding: "16px 20px",
        fontFamily: "JetBrains Mono",
        fontSize: FONT_SIZE,
        lineHeight: `${LINE_HEIGHT}px`,
        whiteSpace: "pre",
      },
      children: [
        // Header bar
        {
          type: "div",
          props: {
            style: {
              color: LINE_NUM_COLOR,
              fontSize: FONT_SIZE - 2,
              marginBottom: 8,
              borderBottom: `1px solid ${LINE_NUM_COLOR}33`,
              paddingBottom: 4,
            },
            children: filename,
          },
        },
        // Code rows
        ...tokenRows.map((tokens, idx) => ({
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
            },
            children: [
              // Line number gutter
              {
                type: "span",
                props: {
                  style: {
                    color: LINE_NUM_COLOR,
                    minWidth: 32,
                    textAlign: "right" as const,
                    marginRight: 16,
                  },
                  children: String(startLine + idx),
                },
              },
              // Token spans — single container, no wrapping
              {
                type: "span",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                  },
                  children: tokens.map((token) => ({
                    type: "span",
                    props: {
                      style: { color: token.color || FG },
                      children: token.content,
                    },
                  })),
                },
              },
            ],
          },
        })),
      ],
    },
  };
}

/** Detect language from filename extension, fall back to "text" */
function detectLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    fish: "fish",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    kt: "kotlin",
    swift: "swift",
    php: "php",
    lua: "lua",
    zig: "zig",
    prisma: "prisma",
    dockerfile: "dockerfile",
    xml: "xml",
    vue: "vue",
    svelte: "svelte",
  };
  // Handle "Dockerfile" (no extension)
  const basename = filename.split("/").pop()?.toLowerCase() ?? "";
  if (basename === "dockerfile") return "dockerfile";
  if (basename === "makefile") return "makefile";

  return map[ext] ?? "text";
}

/** Highlight source code with Shiki, return token rows */
async function highlight(code: string, lang: string): Promise<TokenInfo[][]> {
  const highlighter = await getHighlighter(lang);

  const result = highlighter.codeToTokens(code, {
    theme: "github-dark-dimmed",
    lang: lang as import("shiki").BundledLanguage,
  });

  return result.tokens.map((row: ThemedToken[]) =>
    row.map((t) => ({ color: t.color ?? FG, content: t.content })),
  );
}

/** Slice an array of rows into chunks of LINES_PER_SLICE */
function chunkRows<T>(rows: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += LINES_PER_SLICE) {
    chunks.push(rows.slice(i, i + LINES_PER_SLICE));
  }
  return chunks;
}

/** Measure the longest visual line (in characters) within a set of token rows */
function longestLineLength(tokenRows: TokenInfo[][]): number {
  let max = 0;
  for (const row of tokenRows) {
    let len = 0;
    for (const token of row) {
      len += token.content.length;
    }
    if (len > max) max = len;
  }
  return max;
}

/** Render a single CodeFile to one-or-more PNGs */
export async function renderFile(file: CodeFile): Promise<ScreenshotResult[]> {
  const font = await getFont();
  const lang = detectLang(file.filename);

  // Cap lines to MAX_LINES
  const lines = file.content.split("\n").slice(0, MAX_LINES);
  const code = lines.join("\n");

  let tokenRows: TokenInfo[][];
  try {
    tokenRows = await highlight(code, lang);
  } catch {
    // Shiki didn't recognise the language — fallback to plain text
    tokenRows = await highlight(code, "text");
  }

  const chunks = chunkRows(tokenRows);
  const results: ScreenshotResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const startLine = i * LINES_PER_SLICE + 1;
    const chunk = chunks[i]!;

    const vdom = renderToCode(chunk, startLine, file.filename);

    // Calculate width from longest line in this chunk
    const maxChars = longestLineLength(chunk);
    const contentWidth = maxChars * CHAR_WIDTH + GUTTER_WIDTH + PADDING_X;
    const logicalWidth = Math.max(contentWidth, MIN_WIDTH);

    const svg = await satori(vdom as Parameters<typeof satori>[0], {
      width: logicalWidth,
      fonts: [
        {
          name: "JetBrains Mono",
          data: font,
          weight: 400,
          style: "normal" as const,
        },
      ],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: RENDER_SCALE },
    });
    const png = Buffer.from(resvg.render().asPng());

    const sliceSuffix = chunks.length > 1 ? `_part${i + 1}` : "";
    const basename = file.filename.replace(/[/\\]/g, "_");
    results.push({ filename: `${basename}${sliceSuffix}.png`, png });
  }

  return results;
}
