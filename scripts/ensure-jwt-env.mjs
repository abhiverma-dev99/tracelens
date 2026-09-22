import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve("D:/tracelens/tracelens-api/.env");
let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

const ensure = (key) => {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(re);
  if (!match || !match[1].trim()) {
    const value = crypto.randomBytes(48).toString("base64");
    if (match) {
      content = content.replace(re, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}\n`;
    }
    return `updated ${key}`;
  }
  return `exists ${key}`;
};

const messages = [ensure("JWT_SECRET"), ensure("JWT_REFRESH_SECRET")];
if (!/^FRONTEND_ORIGIN=/m.test(content)) {
  content += "\nFRONTEND_ORIGIN=http://localhost:4200\n";
  messages.push("updated FRONTEND_ORIGIN");
} else {
  messages.push("exists FRONTEND_ORIGIN");
}

fs.writeFileSync(envPath, content);
console.log(messages.join("\n"));
