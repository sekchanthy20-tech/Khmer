import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = (() => {
  try {
    const database = new Database("tests.db");
    database.exec(`
      CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade TEXT NOT NULL,
        language TEXT,
        config TEXT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return database;
  } catch (e) {
    console.error("SQLite failed, using in-memory mock", e);
    return {
      prepare: () => ({ all: () => [], run: () => ({ lastInsertRowid: Date.now() }) }),
      exec: () => {}
    } as any;
  }
})();

export const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/tests", (req, res) => {
    try {
      const tests = db.prepare("SELECT * FROM tests ORDER BY created_at DESC").all();
      res.json(tests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tests" });
    }
  });

  app.post("/api/tests", (req, res) => {
    try {
      const { title, subject, grade, language, config, content } = req.body;
      const info = db.prepare(
        "INSERT INTO tests (title, subject, grade, language, config, content) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(title, subject, grade, language, JSON.stringify(config), JSON.stringify(content));
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save test" });
    }
  });

  app.delete("/api/tests/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM tests WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete test" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
