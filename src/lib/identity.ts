export function normalizeIdentity(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}
