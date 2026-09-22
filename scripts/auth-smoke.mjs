const email = "phase2.1805801713@example.com";
const base = "http://localhost:3000";

const request = async (method, path, { body, token, cookie } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
};

const results = [];
results.push(["wrong_otp", await request("POST", "/api/auth/verify-otp", { body: { email, otp: "000000" } })]);
results.push(["unverified_signin", await request("POST", "/api/auth/signin", { body: { email, password: "password123" } })]);
const verify = await request("POST", "/api/auth/verify-otp", { body: { email, otp: "856601" } });
results.push(["verify_otp", verify]);
results.push(["reuse_otp", await request("POST", "/api/auth/verify-otp", { body: { email, otp: "856601" } })]);
const token = verify.json?.data?.accessToken;
results.push(["incidents_auth", await request("GET", "/api/incidents", { token })]);
results.push(["wrong_password", await request("POST", "/api/auth/signin", { body: { email, password: "wrongpass" } })]);
results.push(["unknown_email", await request("POST", "/api/auth/signin", { body: { email: "nobody@example.com", password: "password123" } })]);
results.push(["signin", await request("POST", "/api/auth/signin", { body: { email, password: "password123" } })]);

for (const [name, result] of results) {
  console.log(name, result.status, JSON.stringify(result.json));
}
