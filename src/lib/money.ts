export function rupeesToPaise(amount: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error("Invalid INR amount");

  const paise =
    BigInt(match[1]) * BigInt("100") +
    BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("INR amount is too large");
  }

  return Number(paise);
}
