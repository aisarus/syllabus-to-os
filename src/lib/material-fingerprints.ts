const KEY = "lamdan.material-fingerprints.v1";

type FingerprintIndex = Record<string, string>;

export async function fingerprintFile(file: File): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function materialIdForFingerprint(fingerprint: string): string | undefined {
  return loadIndex()[fingerprint];
}

export function rememberMaterialFingerprint(materialId: string, fingerprint?: string): void {
  if (!fingerprint || typeof localStorage === "undefined") return;
  const index = loadIndex();
  index[fingerprint] = materialId;
  try {
    localStorage.setItem(KEY, JSON.stringify(index));
  } catch {
    // The material remains usable even when the optional duplicate index cannot be persisted.
  }
}

export function forgetMaterialFingerprint(materialId: string): void {
  if (typeof localStorage === "undefined") return;
  const index = loadIndex();
  let changed = false;
  for (const [fingerprint, linkedMaterialId] of Object.entries(index)) {
    if (linkedMaterialId !== materialId) continue;
    delete index[fingerprint];
    changed = true;
  }
  if (!changed) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(index));
  } catch {
    // Best-effort cleanup only.
  }
}

function loadIndex(): FingerprintIndex {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([fingerprint, materialId]) =>
          typeof fingerprint === "string" && typeof materialId === "string",
      ),
    );
  } catch {
    return {};
  }
}
