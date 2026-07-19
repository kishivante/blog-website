import { mkdir, readFile, rm, stat, readdir } from "node:fs/promises";
import path from "node:path";
import type {
  PutObjectInput,
  StorageAdapter,
  StoredObject,
} from "@/storage/storage-adapter";
import { assertStorageKey } from "@/storage/storage-adapter";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    assertStorageKey(key);
    const root = path.resolve(this.root);
    const absolute = path.resolve(root, ...key.split("/"));
    if (!absolute.startsWith(`${root}${path.sep}`))
      throw new Error("Storage yolu kök dizinin dışında.");
    return absolute;
  }
  async put(input: PutObjectInput) {
    const absolute = this.resolve(input.key);
    await mkdir(path.dirname(absolute), { recursive: true, mode: 0o750 });
    const handle = await import("node:fs/promises").then(({ open }) =>
      open(absolute, "wx", 0o640),
    );
    try {
      await handle.writeFile(input.body);
    } finally {
      await handle.close();
    }
  }
  async get(key: string): Promise<StoredObject | null> {
    try {
      const absolute = this.resolve(key);
      const [body, info] = await Promise.all([
        readFile(absolute),
        stat(absolute),
      ]);
      return {
        body,
        contentType:
          contentTypes[path.extname(absolute)] ?? "application/octet-stream",
        contentLength: info.size,
        contentDisposition: "inline",
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async exists(key: string) {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
  async list(prefix: string) {
    if (prefix) assertStorageKey(prefix);
    const base = prefix ? this.resolve(prefix) : path.resolve(this.root);
    const output: string[] = [];
    const walk = async (directory: string) => {
      for (const item of await readdir(directory, {
        withFileTypes: true,
      }).catch(() => [])) {
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) await walk(absolute);
        else if (item.isFile())
          output.push(
            path
              .relative(path.resolve(this.root), absolute)
              .split(path.sep)
              .join("/"),
          );
      }
    };
    await walk(base);
    return output;
  }
  async signedUrl(key: string) {
    assertStorageKey(key);
    return `/api/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
