export function normalizeRoleKeyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildRoleKey(company: string, role: string) {
  const normalizedCompany = normalizeRoleKeyPart(company);
  const normalizedRole = normalizeRoleKeyPart(role);

  return [normalizedCompany, normalizedRole].filter(Boolean).join("::");
}
