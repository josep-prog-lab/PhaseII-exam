// Deno Deploy / Supabase Edge Function to upload exam recordings to Google Drive
// Expects secrets:
// - GDRIVE_SERVICE_ACCOUNT_JSON: Raw JSON string of the service account
// - GDRIVE_FOLDER_ID: Destination folder ID in Drive

type GoogleAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncode(str: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(data));
  const sigB64 = base64UrlEncodeBytes(new Uint8Array(sig));
  return `${data}.${sigB64}`;
}

async function getAccessToken(saJson: any): Promise<string> {
  const clientEmail = saJson.client_email as string | undefined;
  const privateKey = saJson.private_key as string | undefined;
  if (!clientEmail || !privateKey) throw new Error("Invalid service account JSON");

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwtRS256({
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: GOOGLE_TOKEN_URI,
    iat: now,
    exp: now + 3600,
  }, privateKey);

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", assertion);
  const res = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = (await res.json()) as GoogleAccessTokenResponse;
  return data.access_token;
}

function toRoman(n: number): string {
  const romans: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [val, sym] of romans) {
    while (n >= val) { result += sym; n -= val; }
  }
  return result;
}

async function driveListByExactName(token: string, folderId: string, name: string): Promise<number> {
  const params = new URLSearchParams({
    q: `name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return (data.files?.length ?? 0) as number;
}

async function ensureUniqueFileName(token: string, folderId: string, baseName: string): Promise<string> {
  const ext = baseName.endsWith(".webm") ? "" : ".webm";
  let candidate = `${baseName}${ext}`;
  let idx = 1;
  while ((await driveListByExactName(token, folderId, candidate)) > 0) {
    idx += 1; // II, III, ...
    const suffix = ` (${toRoman(idx)})`;
    const nameOnly = baseName.replace(/\.webm$/i, "");
    candidate = `${nameOnly}${suffix}.webm`;
  }
  return candidate;
}

async function uploadToDrive(token: string, folderId: string, file: Blob, desiredName: string) {
  const name = await ensureUniqueFileName(token, folderId, desiredName);
  const initRes = await fetch(DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "video/webm",
      "X-Upload-Content-Length": String(file.size),
    },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  if (!initRes.ok) throw new Error(`Failed to start upload: ${initRes.status}`);
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Missing upload session URL");

  const putRes = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type || "video/webm" }, body: file });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
  const uploaded = await putRes.json();

  const metaRes = await fetch(`${DRIVE_FILES_URL}/${uploaded.id}?fields=webViewLink,webContentLink,name,id`, { headers: { Authorization: `Bearer ${token}` } });
  const meta = metaRes.ok ? await metaRes.json() : {};
  return { ...uploaded, ...meta };
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const form = await req.formData();
    const file = form.get("file");
    const candidateName = String(form.get("candidateName") || "Candidate");
    const desiredName = `${candidateName}`.trim();

    if (!(file instanceof Blob)) return new Response("file is required", { status: 400 });

    const saRaw = Deno.env.get("GDRIVE_SERVICE_ACCOUNT_JSON");
    const folderId = Deno.env.get("GDRIVE_FOLDER_ID");
    if (!saRaw || !folderId) return new Response("GDrive secrets not configured", { status: 500 });
    const saJson = JSON.parse(saRaw);
    const token = await getAccessToken(saJson);
    const driveFile = await uploadToDrive(token, folderId, file, desiredName);

    return new Response(JSON.stringify(driveFile), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// Serve handler
// deno-lint-ignore no-explicit-any
export const serve = (fn: any) => fn;

// Supabase Edge runtime
// @ts-ignore
serve(handler);




