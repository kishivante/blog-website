export function assertLastAdminSafety(input: {
  wasAdmin: boolean;
  remainsActiveAdmin: boolean;
  activeAdminCount: number;
}) {
  if (
    input.wasAdmin &&
    !input.remainsActiveAdmin &&
    input.activeAdminCount <= 1
  ) {
    throw new Error(
      "Son aktif ADMIN rolü kaldırılamaz veya hesabı kapatılamaz.",
    );
  }
}

export function canAccessAdmin(roleCodes: readonly string[]) {
  return roleCodes.some((code) =>
    ["ADMIN", "EDITOR", "MODERATOR"].includes(code),
  );
}
