import { unzipSync, strFromU8 } from "fflate";
import type { CodeFile } from "./types.ts";
import {
  ZIP_MAX_COMPRESSED_BYTES,
  FILE_MAX_UNCOMPRESSED_BYTES,
  ZIP_MAX_FILES,
  SKIP_PATTERNS,
  BINARY_EXTENSIONS,
  TAB_SIZE,
} from "./constants.ts";

export function extractZip(compressedBuffer: Buffer): CodeFile[] {
  if (compressedBuffer.byteLength > ZIP_MAX_COMPRESSED_BYTES) {
    throw new Error(
      `ZIP exceeds the 1 MB compressed size limit (got ${(compressedBuffer.byteLength / 1024).toFixed(1)} KB).`,
    );
  }

  const entries = unzipSync(new Uint8Array(compressedBuffer));
  const files: CodeFile[] = [];

  for (const [path, data] of Object.entries(entries)) {
    // Skip directories (fflate uses trailing slash)
    if (path.endsWith("/")) continue;

    // Skip unwanted paths
    if (SKIP_PATTERNS.some((re) => re.test(path))) continue;

    // Skip binary extensions
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (BINARY_EXTENSIONS.has(ext)) continue;

    // Enforce per-file uncompressed size
    if (data.byteLength > FILE_MAX_UNCOMPRESSED_BYTES) {
      throw new Error(
        `File "${path}" exceeds the 100 KB per-file limit (got ${(data.byteLength / 1024).toFixed(1)} KB).`,
      );
    }

    // Enforce file count limit
    if (files.length >= ZIP_MAX_FILES) {
      throw new Error(
        `ZIP contains more than ${ZIP_MAX_FILES} processable files.`,
      );
    }

    const content = strFromU8(data).replace(/\t/g, " ".repeat(TAB_SIZE));
    files.push({ filename: path, content });
  }

  if (files.length === 0) {
    throw new Error(
      "ZIP contained no processable text files after filtering.",
    );
  }

  return files;
}
