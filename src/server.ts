import express from "express";
import path from "node:path";
import { loadOfficialStore } from "./official-store.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.resolve(process.cwd(), "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

app.get("/api/status", (_req, res) => {
  const store = loadOfficialStore();
  if (!store.ready) {
    return res.status(503).json({ ready: false, message: "SYSTEM NOT READY" });
  }
  return res.json({
    ready: true,
    message: "READY",
    questionCount: store.bank.length,
    hash: store.hash,
  });
});

app.get("/api/questions", (_req, res) => {
  const store = loadOfficialStore();
  if (!store.ready) {
    return res.status(503).json({ ready: false, message: "SYSTEM NOT READY" });
  }
  return res.json({ ready: true, questions: store.bank });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`ohotminimum-official-trainer listening on :${port}`);
});
