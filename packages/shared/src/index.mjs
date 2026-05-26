import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_SERVER_PORT = 43118;
export const DEFAULT_WORKER_PORT = 43119;

export function resolveWorkspaceRoot(fromUrl = import.meta.url) {
  let current = dirname(fileURLToPath(fromUrl));

  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }

  return process.cwd();
}

export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function saveJson(filePath, value) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function writeText(filePath, value) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, value, "utf8");
}

export function resolveFromRoot(rootPath, ...parts) {
  return resolve(rootPath, ...parts);
}

export function toFileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

export function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export function createRunId(prefix = "run") {
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${rand}`;
}

export function readRequestBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolvePromise(null);
        return;
      }

      const raw = Buffer.concat(chunks).toString("utf8");
      resolvePromise(raw ? JSON.parse(raw) : null);
    });

    req.on("error", rejectPromise);
  });
}

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

export async function waitForHealth(url, timeoutMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore retries while the process is still booting.
    }

    await sleep(250);
  }

  throw new Error(`Health check timed out: ${url}`);
}
