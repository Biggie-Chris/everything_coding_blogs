interface Env {
  ALLOWED_GITHUB_LOGIN: string;
  CMS_ORIGIN: string;
  GITHUB_OAUTH_ID: string;
  GITHUB_OAUTH_SECRET: string;
  GITHUB_REPO_PRIVATE?: string;
}

const OAUTH_STATE_COOKIE = "decap_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function createState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function noStoreHeaders(headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  result.set("Cache-Control", "no-store");
  result.set("X-Content-Type-Options", "nosniff");
  return result;
}

function errorResponse(message: string, status = 400): Response {
  return new Response(message, { status, headers: noStoreHeaders() });
}

function hasAllowedLogin(login: string, allowedLogins: string): boolean {
  return allowedLogins
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(login.toLowerCase());
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    const codePoint = character.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${codePoint}`;
  });
}

function callbackPage(
  status: "success" | "error",
  payload: Record<string, string>,
  env: Env,
): Response {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const body = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Authorizing CMS…</title></head>
  <body>
    <p>${status === "success" ? "Authorization complete. You can close this window." : "Authorization failed. You can close this window."}</p>
    <script>
      const message = ${scriptJson(message)};
      const targetOrigin = ${scriptJson(env.CMS_ORIGIN)};
      const receiveMessage = (event) => {
        if (event.origin !== targetOrigin) return;
        window.opener?.postMessage(message, targetOrigin);
        window.removeEventListener("message", receiveMessage);
      };
      window.addEventListener("message", receiveMessage);
      window.opener?.postMessage("authorizing:github", targetOrigin);
    </script>
  </body>
</html>`;

  return new Response(body, {
    status: status === "success" ? 200 : 403,
    headers: noStoreHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'",
      "Referrer-Policy": "no-referrer",
    }),
  });
}

async function exchangeCodeForToken(code: string, callbackUrl: string, env: Env): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_ID,
      client_secret: env.GITHUB_OAUTH_SECRET,
      code,
      redirect_uri: callbackUrl,
    }),
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? "GitHub did not return an access token.");
  }

  return data.access_token;
}

async function getGitHubLogin(token: string): Promise<string> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "everything-coding-cms-auth",
    },
  });
  const data = (await response.json()) as { login?: string };

  if (!response.ok || !data.login) {
    throw new Error("Could not verify the GitHub account.");
  }

  return data.login;
}

function buildCallbackUrl(origin: string): string {
  return `${origin}/callback`;
}

function handleAuth(url: URL, env: Env): Response {
  if (url.searchParams.get("provider") !== "github") {
    return errorResponse("Invalid OAuth provider.");
  }
  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET || !env.ALLOWED_GITHUB_LOGIN) {
    return errorResponse("OAuth proxy is not configured.", 503);
  }

  const state = createState();
  const privateRepo = env.GITHUB_REPO_PRIVATE === "1";
  const scope = privateRepo ? "repo read:user" : "public_repo read:user";
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", env.GITHUB_OAUTH_ID);
  authorizationUrl.searchParams.set("redirect_uri", buildCallbackUrl(url.origin));
  authorizationUrl.searchParams.set("scope", scope);
  authorizationUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: noStoreHeaders({
      Location: authorizationUrl.toString(),
      "Set-Cookie": `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=${OAUTH_STATE_TTL_SECONDS}`,
    }),
  });
}

async function handleCallback(request: Request, url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(`${OAUTH_STATE_COOKIE}=`.length);

  if (!code || !state || !cookieState || state !== cookieState) {
    return callbackPage(
      "error",
      { error: "The login session expired or could not be verified." },
      env,
    );
  }

  try {
    const token = await exchangeCodeForToken(code, buildCallbackUrl(url.origin), env);
    const login = await getGitHubLogin(token);
    if (!hasAllowedLogin(login, env.ALLOWED_GITHUB_LOGIN)) {
      return callbackPage(
        "error",
        { error: "This GitHub account is not allowed to publish." },
        env,
      );
    }
    return callbackPage("success", { token }, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub authorization failed.";
    return callbackPage("error", { error: message }, env);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET") return errorResponse("Method not allowed.", 405);
    if (url.pathname === "/auth") return handleAuth(url, env);
    if (url.pathname === "/callback") return handleCallback(request, url, env);
    return new Response("CMS OAuth proxy is running.", { headers: noStoreHeaders() });
  },
};
