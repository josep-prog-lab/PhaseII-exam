// Drive upload utilities using a Google service account in the browser.
// WARNING: Exposing service account credentials in the client is insecure.
// This implementation follows the user's request and expects the JSON at project root.

import storageConfig from "../../../examspace-storage.json";

type GoogleAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

const JWT_AUDIENCE = GOOGLE_TOKEN_URI;
const JWT_ALG = "RS256";

// Scope for Drive file create/read metadata
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  // btoa works on binary strings
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: JWT_ALG, typ: "JWT" };
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

  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(data));
  const sigB64 = base64UrlEncode(signature);
  return `${data}.${sigB64}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  const clientEmail = (storageConfig as any).client_email as string | undefined;
  const privateKey = (storageConfig as any).private_key as string | undefined;
  if (!clientEmail || !privateKey) {
    throw new Error("Missing service account credentials in examspace-storage.json");
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + 3600,
  };

  const assertion = await signJwtRS256(jwtPayload, privateKey);

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", assertion);

  const res = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to obtain Google access token: ${res.status} ${text}`);
  }
  const data = (await res.json()) as GoogleAccessTokenResponse;
  return data.access_token;
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
  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return (data.files?.length ?? 0) as number;
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

export async function ensureUniqueFileName(token: string, folderId: string, baseName: string): Promise<string> {
  // Try exact baseName.webm, then append (I), (II), ... before extension
  const ext = baseName.endsWith(".webm") ? "" : ".webm";
  let candidate = `${baseName}${ext}`;
  let idx = 1;
  while ((await driveListByExactName(token, folderId, candidate)) > 0) {
    idx += 1; // Start from II if one exists already
    const suffix = ` (${toRoman(idx)})`;
    const nameOnly = baseName.replace(/\.webm$/i, "");
    candidate = `${nameOnly}${suffix}.webm`;
  }
  return candidate;
}

type UploadResult = { id: string; name: string; webViewLink?: string; webContentLink?: string };

export async function uploadBlobToDrive(params: { blob: Blob; desiredName: string; folderId?: string }): Promise<UploadResult> {
  const token = await getAccessToken();
  const folderId = params.folderId || (storageConfig as any).folder_id;
  if (!folderId) {
    throw new Error("Missing Google Drive folder_id in examspace-storage.json");
  }

  const uniqueName = await ensureUniqueFileName(token, folderId, params.desiredName);

  // Initiate resumable session
  const metadata = { name: uniqueName, parents: [folderId] } as any;
  const initRes = await fetch(DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": params.blob.type || "video/webm",
      "X-Upload-Content-Length": String(params.blob.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Failed to start resumable upload: ${initRes.status} ${text}`);
  }
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No resumable upload Location returned by Drive");

  // Upload the bytes
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": params.blob.type || "video/webm",
    },
    body: params.blob,
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`Drive upload failed: ${putRes.status} ${text}`);
  }
  const uploaded = (await putRes.json()) as UploadResult;

  // Retrieve webViewLink and webContentLink
  const metaRes = await fetch(`${DRIVE_FILES_URL}/${uploaded.id}?fields=webViewLink,webContentLink,name,id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    // Fallback to uploaded object if metadata fetch fails
    return uploaded;
  }
  const meta = (await metaRes.json()) as UploadResult;
  return { ...uploaded, ...meta };
}


