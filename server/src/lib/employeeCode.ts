import { supabase } from "./supabase";

/**
 * Generate a unique employee code
 * Format: EMP-YYYY-XXX (e.g., EMP-2024-001)
 */
export async function generateEmployeeCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `EMP-${currentYear}`;

  const { data: users } = await supabase
    .from("users")
    .select("employeeCode")
    .like("employeeCode", `${prefix}%`)
    .order("employeeCode", { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (users?.length && users[0].employeeCode) {
    const parts = users[0].employeeCode.split("-");
    if (parts.length === 3 && parts[2]) {
      const n = parseInt(parts[2], 10);
      if (!isNaN(n)) nextNumber = n + 1;
    }
  }

  const formattedNumber = nextNumber.toString().padStart(3, "0");
  const employeeCode = `${prefix}-${formattedNumber}`;

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("employeeCode", employeeCode)
    .maybeSingle();

  if (existing) {
    const maxRetries = 100;
    for (let i = 1; i <= maxRetries; i++) {
      const nextNum = nextNumber + i;
      const newCode = `${prefix}-${nextNum.toString().padStart(3, "0")}`;
      const { data: check } = await supabase
        .from("users")
        .select("id")
        .eq("employeeCode", newCode)
        .maybeSingle();
      if (!check) return newCode;
    }
    throw new Error(`Failed to generate unique employee code after ${maxRetries} attempts`);
  }

  return employeeCode;
}

export function isValidEmployeeCodeFormat(code: string): boolean {
  return /^EMP-\d{4}-\d{3}$/.test(code);
}
