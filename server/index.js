const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { getDb, all, get, run } = require("./database");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// =====================
// USERS
// =====================

app.post("/api/users/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "Заполните все поля" });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashed]
    );
    res.json({ id: result.lastInsertRowid, username, email });
  } catch (e) {
    res.status(400).json({ error: "Пользователь с таким именем или email уже существует" });
  }
});

app.post("/api/users/login", async (req, res) => {
  const { email, password } = req.body;
  const user = get("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Неверный email или пароль" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Неверный email или пароль" });
  res.json({ id: user.id, username: user.username, email: user.email });
});

app.get("/api/users/:id", (req, res) => {
  const user = get("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.params.id]);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(user);
});

// =====================
// TEMPLATES
// =====================

app.get("/api/templates", (req, res) => {
  const { category } = req.query;
  let query = "SELECT id, name, category, description, is_default, created_at FROM templates";
  const params = [];
  if (category) { query += " WHERE category = ?"; params.push(category); }
  query += " ORDER BY is_default DESC, created_at DESC";
  res.json(all(query, params));
});

app.get("/api/templates/:id", (req, res) => {
  const tpl = get("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!tpl) return res.status(404).json({ error: "Шаблон не найден" });
  res.json(tpl);
});

app.post("/api/templates", (req, res) => {
  const { name, category, description, xml_data, user_id } = req.body;
  if (!name || !xml_data) return res.status(400).json({ error: "name и xml_data обязательны" });
  const result = run(
    "INSERT INTO templates (name, category, description, xml_data, user_id) VALUES (?, ?, ?, ?, ?)",
    [name, category || "other", description || "", xml_data, user_id || null]
  );
  res.json({ id: result.lastInsertRowid, name, category, description });
});

app.put("/api/templates/:id", (req, res) => {
  const { name, category, description, xml_data } = req.body;
  const tpl = get("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!tpl) return res.status(404).json({ error: "Шаблон не найден" });
  run(
    "UPDATE templates SET name=?, category=?, description=?, xml_data=?, updated_at=datetime('now') WHERE id=?",
    [name || tpl.name, category || tpl.category, description || tpl.description, xml_data || tpl.xml_data, req.params.id]
  );
  res.json({ success: true });
});

app.delete("/api/templates/:id", (req, res) => {
  const tpl = get("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!tpl) return res.status(404).json({ error: "Шаблон не найден" });
  if (tpl.is_default) return res.status(403).json({ error: "Нельзя удалить стандартный шаблон" });
  run("DELETE FROM templates WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// =====================
// PROJECTS
// =====================

app.get("/api/projects", (req, res) => {
  const { user_id } = req.query;
  let query = "SELECT id, name, page_width, page_height, orientation, user_id, template_id, created_at, updated_at FROM projects";
  const params = [];
  if (user_id) { query += " WHERE user_id = ?"; params.push(user_id); }
  query += " ORDER BY updated_at DESC";
  res.json(all(query, params));
});

app.get("/api/projects/:id", (req, res) => {
  const project = get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
  if (!project) return res.status(404).json({ error: "Проект не найден" });
  res.json(project);
});

app.post("/api/projects", (req, res) => {
  const { name, xml_data, page_width, page_height, orientation, user_id, template_id } = req.body;
  if (!name || !xml_data) return res.status(400).json({ error: "name и xml_data обязательны" });
  const result = run(
    "INSERT INTO projects (name, xml_data, page_width, page_height, orientation, user_id, template_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, xml_data, page_width || 600, page_height || 400, orientation || "landscape", user_id || null, template_id || null]
  );
  run("INSERT INTO save_history (project_id, xml_data) VALUES (?, ?)", [result.lastInsertRowid, xml_data]);
  res.json({ id: result.lastInsertRowid, name });
});

app.put("/api/projects/:id", (req, res) => {
  const { name, xml_data, page_width, page_height, orientation } = req.body;
  const project = get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
  if (!project) return res.status(404).json({ error: "Проект не найден" });
  run(
    "UPDATE projects SET name=?, xml_data=?, page_width=?, page_height=?, orientation=?, updated_at=datetime('now') WHERE id=?",
    [name || project.name, xml_data || project.xml_data, page_width || project.page_width, page_height || project.page_height, orientation || project.orientation, req.params.id]
  );
  if (xml_data) {
    run("INSERT INTO save_history (project_id, xml_data) VALUES (?, ?)", [req.params.id, xml_data]);
  }
  res.json({ success: true });
});

app.delete("/api/projects/:id", (req, res) => {
  const project = get("SELECT * FROM projects WHERE id = ?", [req.params.id]);
  if (!project) return res.status(404).json({ error: "Проект не найден" });
  run("DELETE FROM projects WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// =====================
// HISTORY
// =====================

app.get("/api/projects/:id/history", (req, res) => {
  res.json(all("SELECT id, saved_at FROM save_history WHERE project_id = ? ORDER BY saved_at DESC LIMIT 20", [req.params.id]));
});

app.get("/api/history/:id", (req, res) => {
  const entry = get("SELECT * FROM save_history WHERE id = ?", [req.params.id]);
  if (!entry) return res.status(404).json({ error: "Запись не найдена" });
  res.json(entry);
});

// =====================
// ЗАПУСК
// =====================

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
    console.log(`📦 База данных: flyer.db`);
    console.log(`🔐 Пароли хешируются через bcrypt`);
    console.log(`\nДоступные эндпоинты:`);
    console.log(`  GET/POST       /api/templates`);
    console.log(`  GET/PUT/DELETE /api/templates/:id`);
    console.log(`  GET/POST       /api/projects`);
    console.log(`  GET/PUT/DELETE /api/projects/:id`);
    console.log(`  GET            /api/projects/:id/history`);
    console.log(`  POST           /api/users/register`);
    console.log(`  POST           /api/users/login`);
  });
});