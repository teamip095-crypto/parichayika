/**
 * Utility functions for Date formatting across the entire Parichayika application.
 * Ensures strict DD/MM/YYYY formatting for Date of Birth and other matrimony/ad dates.
 */

export function formatDobToDDMMYYYY(val?: string | null): string {
  if (!val || typeof val !== "string" || !val.trim() || val.trim() === "-") {
    return "-";
  }

  const trimmed = val.trim();

  // Case 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. 1998-05-24 or 1998-5-4)
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:T.*)?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  // Case 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (e.g. 24-05-1998, 24/5/1998, 4/5/1998)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  // Case 3: ISO timestamp or standard Date string
  if (trimmed.includes("T") || trimmed.includes("Z")) {
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
      const day = String(parsedDate.getDate()).padStart(2, "0");
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const year = parsedDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  return trimmed;
}

/**
 * Converts any date representation to YYYY-MM-DD for native HTML datepicker value
 */
export function parseDateComponents(val?: string | null): { day: number; month: number; year: number } | null {
  if (!val || typeof val !== "string" || !val.trim() || val.trim() === "-") {
    return null;
  }
  const formatted = formatDobToDDMMYYYY(val);
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }
  return null;
}

export function toDDMMYYYY(day: number, month: number, year: number): string {
  const d = String(day).padStart(2, "0");
  const m = String(month).padStart(2, "0");
  const y = String(year);
  return `${d}/${m}/${y}`;
}

