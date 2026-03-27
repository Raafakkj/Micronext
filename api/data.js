const { normalizeState, readState, writeState } = require("./_store");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const state = await readState();
    sendJson(res, 200, { ok: true, state });
    return;
  }

  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    const next = normalizeState(body && body.state ? body.state : body);
    const saved = await writeState(next);
    sendJson(res, 200, { ok: true, state: saved });
    return;
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const current = await readState();
    const patch = body && body.state ? body.state : body;
    const merged = normalizeState({ ...current, ...(patch || {}) });
    const saved = await writeState(merged);
    sendJson(res, 200, { ok: true, state: saved });
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
