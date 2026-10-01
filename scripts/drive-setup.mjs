// One-time setup for PDF uploads to Google Drive. Run it on your own computer:
//
//   GOOGLE_DRIVE_CLIENT_ID=… GOOGLE_DRIVE_CLIENT_SECRET=… node scripts/drive-setup.mjs
//
// It opens a Google sign-in link (sign in as the commission's account), creates the folder the
// site will upload into, and prints the four lines to add to .env.local and to the host's
// environment variables. The client ID and secret come from a Google Cloud OAuth client of type
// "Desktop app" with the Drive API enabled.

import { createServer } from "node:http";

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET first.");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;
const state = crypto.randomUUID();
const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
// prompt=consent makes Google issue a refresh token even if this account approved the app before.
consent.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/drive.file", access_type: "offline", prompt: "consent", state }).toString();

const server = createServer(async (request, response) => {
  const params = new URL(request.url, redirectUri).searchParams;
  if (params.get("state") !== state || !params.get("code")) return response.writeHead(400).end("Not the sign-in this script started.");

  try {
    const token = await post("https://oauth2.googleapis.com/token", new URLSearchParams({ code: params.get("code"), client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }));
    if (!token.refresh_token) throw new Error("Google didn’t return a refresh token.");
    const folder = await post("https://www.googleapis.com/drive/v3/files?fields=id", JSON.stringify({ name: "Website documents", mimeType: "application/vnd.google-apps.folder" }), { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" });

    response.end("Done. Go back to the terminal.");
    console.log(`\nAdd these to .env.local and to your host's environment variables:\n\nGOOGLE_DRIVE_CLIENT_ID=${clientId}\nGOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}\nGOOGLE_DRIVE_REFRESH_TOKEN=${token.refresh_token}\nGOOGLE_DRIVE_FOLDER_ID=${folder.id}\n`);
  } catch (error) {
    response.writeHead(500).end("Something went wrong. See the terminal.");
    console.error(error);
    process.exitCode = 1;
  }
  server.close();
});

async function post(url, body, headers = {}) {
  const response = await fetch(url, { method: "POST", body, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(`${url}: ${JSON.stringify(data)}`);
  return data;
}

server.listen(PORT, "127.0.0.1", () => console.log(`Open this link and sign in as the commission's Google account:\n\n${consent}\n`));
