export type StorageVisibility = "public" | "private";
export type StoredObject = {
  body: Uint8Array;
  contentType: string;
  contentLength?: number;
  contentDisposition?: string;
};
export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
  visibility: StorageVisibility;
  contentDisposition: string;
};

export interface StorageAdapter {
  readonly driver: "local" | "s3";
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export function assertStorageKey(key: string) {
  if (
    !key ||
    key.length > 500 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key
      .split("/")
      .some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          !/^[a-zA-Z0-9._-]+$/.test(segment),
      )
  ) {
    throw new Error("Geçersiz storage anahtarı.");
  }
}
