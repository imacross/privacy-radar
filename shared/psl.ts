// Minimal registrable-domain (eTLD+1) resolver. Not a full Public Suffix List,
// but covers the gTLDs and the common multi-label ccTLD suffixes that show up in
// tracker traffic — enough to tell first-party from third-party reliably.

const MULTI_LABEL_SUFFIXES = new Set([
  // United Kingdom
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk", "ac.uk", "gov.uk", "nhs.uk",
  // Turkey
  "com.tr", "net.tr", "org.tr", "gov.tr", "edu.tr", "web.tr", "gen.tr", "av.tr", "bel.tr", "k12.tr",
  // Australia / NZ
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au", "co.nz", "net.nz", "org.nz", "govt.nz",
  // Japan / Korea / China
  "co.jp", "ne.jp", "or.jp", "go.jp", "ac.jp", "ad.jp", "co.kr", "or.kr", "ne.kr", "go.kr",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn",
  // Brazil / Mexico / Argentina / India
  "com.br", "net.br", "org.br", "gov.br", "com.mx", "org.mx", "gob.mx", "com.ar", "gob.ar",
  "co.in", "net.in", "org.in", "gov.in", "firm.in", "gen.in",
  // Europe (selected)
  "co.za", "org.za", "gov.za", "com.sg", "com.hk", "com.ru", "co.il", "com.ua", "com.pl",
  "com.es", "com.de", "co.id", "com.my", "com.ph", "com.vn", "com.sa", "com.tw", "co.th",
]);

/** Lowercase registrable domain (eTLD+1) for a hostname, or the host itself if too short. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

/** Hostname from any URL string, or "" if unparseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
