const { DEFAULT_STATE, listCategories, readState, writeState } = require("../_store");

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
  const categoryParam = req.query.category;
  const category = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  const validCategories = listCategories().map((item) => item.name);

  if (!validCategories.includes(category)) {
    sendJson(res, 404, { ok: false, error: "Categoria nao encontrada", categories: validCategories });
    return;
  }

  if (req.method === "GET") {
    const state = await readState();
    sendJson(res, 200, { ok: true, category, data: state[category] });
    return;
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const body = await readJsonBody(req);
    const value = body && Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body;
    const state = await readState();
    state[category] = value;
    const saved = await writeState(state);
    sendJson(res, 200, { ok: true, category, data: saved[category] });
    return;
  }

  if (req.method === "DELETE") {
    const state = await readState();
    state[category] = DEFAULT_STATE[category];
    const saved = await writeState(state);
    sendJson(res, 200, { ok: true, category, data: saved[category] });
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
