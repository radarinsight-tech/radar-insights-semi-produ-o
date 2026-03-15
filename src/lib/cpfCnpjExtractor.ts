/**
 * Extracts CPF or CNPJ from text using regex patterns.
 * Returns the first match found (digits only).
 */
export function extractCpfCnpj(text: string): { value: string; formatted: string; type: "CPF" | "CNPJ" } | null {
  // CNPJ patterns: 12.345.678/0001-90 or 12345678000190
  const cnpjFormatted = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  if (cnpjFormatted) {
    const digits = cnpjFormatted[0].replace(/\D/g, "");
    return { value: digits, formatted: cnpjFormatted[0], type: "CNPJ" };
  }

  const cnpjRaw = text.match(/\b\d{14}\b/);
  if (cnpjRaw) {
    const d = cnpjRaw[0];
    const formatted = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    return { value: d, formatted, type: "CNPJ" };
  }

  // CPF patterns: 123.456.789-00 or 12345678900
  const cpfFormatted = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  if (cpfFormatted) {
    const digits = cpfFormatted[0].replace(/\D/g, "");
    return { value: digits, formatted: cpfFormatted[0], type: "CPF" };
  }

  const cpfRaw = text.match(/\b\d{11}\b/);
  if (cpfRaw) {
    const d = cpfRaw[0];
    const formatted = `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    return { value: d, formatted, type: "CPF" };
  }

  return null;
}
