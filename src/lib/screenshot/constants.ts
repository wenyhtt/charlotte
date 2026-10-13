export const ZIP_MAX_COMPRESSED_BYTES = 1 * 1024 * 1024; // 1 MB
export const FILE_MAX_UNCOMPRESSED_BYTES = 100 * 1024; // 100 KB per file
export const ZIP_MAX_FILES = 25;
export const LINES_PER_SLICE = 60;
export const MAX_LINES = 200;
export const TAB_SIZE = 4;
export const RENDER_SCALE = 2;
export const DISCORD_ATTACHMENT_LIMIT = 10;
export const COOLDOWN_SECONDS = 30;

/** Paths/names to skip when extracting a ZIP */
export const SKIP_PATTERNS = [
  /^node_modules\//,
  /^\.git\//,
  /\/node_modules\//,
  /\/\.git\//,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /^__MACOSX\//,
];

/** Extensions treated as binary/non-text — skip entirely */
export const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "webp",
  "svg",
  "pdf",
  "zip",
  "tar",
  "gz",
  "bz2",
  "7z",
  "rar",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "wasm",
  "mp3",
  "mp4",
  "wav",
  "ogg",
  "flac",
  "avi",
  "mov",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "eot",
  "db",
  "sqlite",
  "lock",
]);
