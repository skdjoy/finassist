const KNOWN_ACRONYMS = new Set([
  "KFC", "ATM", "DHL", "SCB", "BD", "US", "SG", "UK", "IN", "LTD",
  "BDT", "USD", "OPC", "TSO", "LLC", "PLC", "CO", "AI",
]);

export function normalizeMerchant(name: string): string {
  if (!name) return "";

  // Strip HTML entities (defense in depth)
  let cleaned = name
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Title-case, preserving known acronyms
  return cleaned
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (KNOWN_ACRONYMS.has(upper)) return upper;
      if (word.length <= 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
