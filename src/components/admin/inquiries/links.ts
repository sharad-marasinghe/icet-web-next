/** Normalise a Sri Lankan / international phone number to digits for wa.me. */
export function waDigits(raw: string | null | undefined): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "94" + d.slice(1); // local 07x xxx xxxx
  else if (d.length === 9 && d.startsWith("7")) d = "94" + d;
  return d.length >= 9 ? d : "";
}

export function waLink(raw: string | null | undefined, message?: string): string | null {
  const d = waDigits(raw);
  if (!d) return null;
  return `https://wa.me/${d}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function telLink(raw: string): string {
  const d = String(raw || "").replace(/[^\d+]/g, "");
  return `tel:${d.startsWith("+") ? d : d.length === 10 && d.startsWith("0") ? "+94" + d.slice(1) : d}`;
}
