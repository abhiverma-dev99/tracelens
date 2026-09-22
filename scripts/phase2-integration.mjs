const base = process.env.API_BASE || "http://localhost:3000";
const email = "phase2.1805801713@example.com";
const password = "password123";

const request = async (method, path, { body, token, headers } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
};

const signin = await request("POST", "/api/auth/signin", { body: { email, password } });
if (signin.status !== 200) {
  console.error("signin_failed", signin.status, signin.json);
  process.exit(1);
}
const token = signin.json.data.accessToken;
const ingestKey = signin.json.data.project.ingestKey;
console.log("signin=200");

const ingest = await request("POST", "/api/incidents", {
  body: {
    message: "Phase 2 SDK integration failure",
    service: "test-service",
    stackTrace: "Error: Phase 2 SDK integration failure\n    at Object.<anonymous> (test.js:1:1)",
  },
  headers: {
    Authorization: `Bearer ${ingestKey}`,
    "X-TraceLens-API-Key": ingestKey,
  },
});
console.log("ingest", ingest.status, ingest.json?.data?.id ? "created" : ingest.json);

const list = await request("GET", "/api/incidents", { token });
console.log("list", list.status, "count=" + (list.json?.data?.length ?? 0));

const incidentId = ingest.json?.data?.id || list.json?.data?.[0]?.id;
if (!incidentId) {
  console.error("no_incident");
  process.exit(1);
}

const abort = new AbortController();
const streamRes = await fetch(`${base}/api/incidents/${incidentId}/analyze/stream`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: abort.signal,
});
console.log("stream_status", streamRes.status, streamRes.headers.get("content-type"));

if (!streamRes.ok || !streamRes.body) {
  process.exit(1);
}

const reader = streamRes.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let chunks = 0;
let sawDone = false;
const started = Date.now();

while (Date.now() - started < 45000) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() || "";
  for (const part of parts) {
    const line = part.split("\n").find((entry) => entry.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "chunk") {
      chunks += 1;
      if (chunks === 1) console.log("first_chunk_ms", Date.now() - started, "section", event.section);
    }
    if (event.type === "done") sawDone = true;
    if (event.type === "error") console.log("stream_error", event.message);
  }
  if (sawDone || chunks >= 3) break;
}

abort.abort();
console.log("stream_chunks", chunks, "done", sawDone);

const noAuth = await request("GET", "/api/incidents");
console.log("incidents_no_auth", noAuth.status);
