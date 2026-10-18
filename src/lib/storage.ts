import "server-only";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Server-side Supabase Storage helpers. Prefers the service-role key when
 * present; otherwise uses the caller-supplied bearer token (admin session) or a
 * signed-in token minted for the configured storage user.
 */
function authHeaders(token?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey();
  return { apikey: key, Authorization: `Bearer ${token || key}` };
}

export function publicUrl(bucket: string, path: string) {
  return `${url()}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadObject(bucket: string, path: string, body: Buffer | Uint8Array | Blob, contentType: string, token?: string, upsert = true) {
  const res = await fetch(`${url()}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": contentType, "x-upsert": upsert ? "true" : "false" },
    body: body instanceof Blob ? body : new Blob([body as BlobPart], { type: contentType }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return { path, url: publicUrl(bucket, path) };
}

export async function deleteObjects(bucket: string, paths: string[], token?: string) {
  if (!paths.length) return;
  const res = await fetch(`${url()}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`Storage delete failed (${res.status})`);
}

/** Download a private object as a Buffer (server only). */
export async function downloadObject(bucket: string, path: string, token?: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(`${url()}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Storage download failed (${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "application/octet-stream" };
}

/** Download any public/remote image to a Buffer. */
export async function fetchBuffer(src: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (iCET site)" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${src}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "application/octet-stream" };
}

/**
 * Obtain a storage-capable bearer token when no service role key is configured:
 * signs in the technical account defined by STORAGE_USER / STORAGE_PASSWORD.
 */
let cachedToken: { token: string; exp: number } | null = null;
export async function serviceToken(): Promise<string | undefined> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const email = process.env.STORAGE_USER;
  const password = process.env.STORAGE_PASSWORD;
  if (!email || !password) return undefined;
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`${url()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
