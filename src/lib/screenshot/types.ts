export interface CodeFile {
  filename: string;
  content: string; // decoded text, tabs expanded
}

export interface ScreenshotResult {
  filename: string; // e.g. "main.ts_1.png"
  png: Buffer;
}
