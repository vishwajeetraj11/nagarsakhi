/**
 * Ward names in the live register can be either a locality (for example,
 * "Station Road") or a generated numeric label (for example, "Ward 07").
 * Numeric labels are already represented by the ward number in headings, so
 * avoid rendering them twice.
 */
export function wardLocalityName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const numericWardLabel = /^ward(?:\s+no\.?)?\s+\d+$/i;
  const parts = trimmed.split(/\s*[\/·|]\s*/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => numericWardLabel.test(part)) ? null : trimmed;
}
