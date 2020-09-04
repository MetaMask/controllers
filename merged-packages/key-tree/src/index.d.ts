declare module "@metamask/key-tree" {
  export function deriveKeyFromPath(key: Buffer | null, fullPath: String): Buffer;
}

export interface Buffer {
  toString(encoding: "utf8" | "hex" | "binary" | "base64" | "ascii"): string;
  slice(start: Number, end: Number): Buffer;
}