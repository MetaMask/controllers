declare module "@metamask/key-tree" {
  export function deriveKeyFromPath(pathSegment: string, parentKey: Buffer | null): Buffer;
  export function isValidFullPath(fullPath: string): boolean;
}

export interface Buffer {
  toString(encoding: "utf8" | "hex" | "binary" | "base64" | "ascii"): string;
  slice(start: Number, end: Number): Buffer;
}
