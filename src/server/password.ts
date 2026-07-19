import argon2 from "argon2";

const weakPasswords = new Set([
  "123456789012",
  "password1234",
  "qwertyuiop12",
  "letmein123456",
  "admin12345678",
  "welcome12345",
  "scarletsatellite",
]);
const dummyPasswordHash =
  "$argon2id$v=19$m=65536,t=3,p=1$8k74RiMiUrDhSgGjdkscAA$p6BrZZQl7jRYtuopK4Y3RYXj9VjNxvYFK23jk53a4G8";

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "Parola en az 12 karakter olmalıdır.";
  if (password.length > 128) return "Parola en fazla 128 karakter olabilir.";
  if (weakPasswords.has(password.toLocaleLowerCase("en-US")))
    return "Bu parola çok yaygın; farklı bir parola veya uzun bir parola cümlesi seçin.";
  if (new Set(password).size < 5) return "Parola yeterince çeşitli değil.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });
}

export async function verifyPassword(
  hash: string | null,
  password: string,
): Promise<boolean> {
  try {
    const valid = await argon2.verify(hash ?? dummyPasswordHash, password);
    return Boolean(hash) && valid;
  } catch {
    return false;
  }
}
