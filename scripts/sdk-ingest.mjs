import { spawn } from "node:child_process";

const base = process.env.API_BASE || "http://localhost:3000";
const signin = await fetch(`${base}/api/auth/signin`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "phase2.1805801713@example.com",
    password: "password123",
  }),
});
const data = await signin.json();
if (!signin.ok) {
  console.error("signin_failed", signin.status);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["examples/sdk-smoke.mjs"],
  {
    cwd: "D:/tracelens/tracelens-node",
    env: {
      ...process.env,
      TRACELENS_API_KEY: data.data.project.ingestKey,
      TRACELENS_BASE_URL: base,
    },
    stdio: "inherit",
  },
);

await new Promise((resolve) => setTimeout(resolve, 2500));
const list = await fetch(`${base}/api/incidents`, {
  headers: { Authorization: `Bearer ${data.data.accessToken}` },
});
const incidents = await list.json();
const found = (incidents.data || []).some((item) =>
  String(item.message).includes("TraceLens SDK test"),
);
console.log("sdk_ingest_found", found, "count", incidents.data?.length ?? 0);
child.kill();
process.exit(found ? 0 : 1);
