const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "flyer.db");

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT NOT NULL UNIQUE,
      email     TEXT NOT NULL UNIQUE,
      password  TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      xml_data    TEXT NOT NULL,
      is_default  INTEGER DEFAULT 0,
      user_id     INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      xml_data    TEXT NOT NULL,
      page_width  INTEGER DEFAULT 600,
      page_height INTEGER DEFAULT 400,
      orientation TEXT DEFAULT 'landscape',
      user_id     INTEGER,
      template_id INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS save_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      xml_data   TEXT NOT NULL,
      saved_at   TEXT DEFAULT (datetime('now'))
    );
  `);

  const count = db.exec("SELECT COUNT(*) as cnt FROM templates WHERE is_default = 1");
  const cnt = count[0]?.values[0][0] || 0;

  if (cnt === 0) {
    const defaultTemplates = [
      {
        name: "Распродажа",
        category: "реклама",
        description: "Яркий шаблон для акций",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="800" height="500" orientation="landscape" background="#1a1a2e" /><elements><text id="2" x="50" y="60" width="700" fontSize="96" fill="#ff6b35" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">РАСПРОДАЖА</text><text id="3" x="50" y="190" width="700" fontSize="52" fill="#ffffff" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">ДО -70% НА ВСЁ</text><text id="4" x="50" y="280" width="700" fontSize="30" fill="#ffd700" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Только до конца недели!</text><text id="5" x="50" y="390" width="700" fontSize="22" fill="#cccccc" fontFamily="Arial" fontWeight="normal" fontStyle="italic" textAlign="center" rotation="0" opacity="1">www.yourshop.ru • +7 (999) 000-00-00</text></elements></flyer>`
      },
      {
        name: "Вечеринка",
        category: "приглашение",
        description: "Стильное приглашение на вечеринку",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="600" height="800" orientation="portrait" background="#0d0d0d" /><elements><text id="2" x="50" y="100" width="500" fontSize="28" fill="#e0c97f" fontFamily="Georgia" fontWeight="normal" fontStyle="italic" textAlign="center" rotation="0" opacity="1">Вы приглашены</text><text id="3" x="30" y="170" width="540" fontSize="86" fill="#ffffff" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">PARTY</text><text id="4" x="30" y="290" width="540" fontSize="38" fill="#e0c97f" fontFamily="Georgia" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">2025</text><text id="5" x="50" y="400" width="500" fontSize="26" fill="#ffffff" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Суббота, 14 июня • 22:00</text><text id="6" x="50" y="450" width="500" fontSize="22" fill="#cccccc" fontFamily="Arial" fontWeight="normal" fontStyle="italic" textAlign="center" rotation="0" opacity="1">ул. Примерная, 1</text><text id="7" x="50" y="680" width="500" fontSize="20" fill="#e0c97f" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Дресс-код: All Black</text></elements></flyer>`
      },
      {
        name: "Набор сотрудников",
        category: "объявление",
        description: "Объявление о найме",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="800" height="500" orientation="landscape" background="#f0f4ff" /><elements><text id="1" x="50" y="50" width="700" fontSize="22" fill="#4a6fa5" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">МЫ РАСШИРЯЕМСЯ</text><text id="2" x="50" y="100" width="700" fontSize="80" fill="#1a3a6b" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">ТРЕБУЮТСЯ</text><text id="3" x="50" y="220" width="700" fontSize="42" fill="#e63946" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">СОТРУДНИКИ</text><text id="4" x="50" y="300" width="700" fontSize="24" fill="#333333" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Опыт не обязателен • Обучение за наш счёт</text><text id="5" x="50" y="350" width="700" fontSize="24" fill="#333333" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Зарплата от 60 000 руб. • Гибкий график</text><text id="6" x="50" y="430" width="700" fontSize="24" fill="#4a6fa5" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Звоните: +7 (999) 000-00-00</text></elements></flyer>`
      },
      {
        name: "Музыкальный фестиваль",
        category: "мероприятие",
        description: "Афиша фестиваля",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="600" height="800" orientation="portrait" background="#0a2342" /><elements><text id="2" x="30" y="70" width="540" fontSize="24" fill="#64ffda" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">ПРЕДСТАВЛЯЕТ</text><text id="3" x="20" y="130" width="560" fontSize="78" fill="#ffffff" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">OPEN AIR</text><text id="4" x="20" y="230" width="560" fontSize="48" fill="#64ffda" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">FEST 2025</text><text id="5" x="30" y="330" width="540" fontSize="26" fill="#ffffff" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">20-22 июня • Городской парк</text><text id="6" x="30" y="400" width="540" fontSize="22" fill="#cccccc" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">10 артистов • 3 сцены</text><text id="7" x="30" y="550" width="540" fontSize="32" fill="#ffd700" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Билеты от 500 руб.</text><text id="8" x="30" y="680" width="540" fontSize="22" fill="#64ffda" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">fest2025.ru</text></elements></flyer>`
      },
      {
        name: "Кофейня",
        category: "реклама",
        description: "Реклама кафе",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="600" height="600" orientation="landscape" background="#2c1810" /><elements><text id="2" x="30" y="80" width="540" fontSize="24" fill="#d4a853" fontFamily="Georgia" fontWeight="normal" fontStyle="italic" textAlign="center" rotation="0" opacity="1">Добро пожаловать в</text><text id="3" x="30" y="130" width="540" fontSize="72" fill="#ffffff" fontFamily="Georgia" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">AROMA</text><text id="4" x="30" y="230" width="540" fontSize="28" fill="#d4a853" fontFamily="Georgia" fontWeight="normal" fontStyle="italic" textAlign="center" rotation="0" opacity="1">coffee &amp; bakery</text><text id="5" x="30" y="320" width="540" fontSize="22" fill="#ffffff" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Эспрессо • Капучино • Латте</text><text id="6" x="30" y="365" width="540" fontSize="22" fill="#ffffff" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Круассаны • Маффины • Торты</text><text id="7" x="30" y="460" width="540" fontSize="24" fill="#d4a853" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Каждый день 8:00 — 22:00</text><text id="8" x="30" y="510" width="540" fontSize="20" fill="#cccccc" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">ул. Кофейная, 15</text></elements></flyer>`
      },
      {
        name: "Фитнес-клуб",
        category: "реклама",
        description: "Реклама фитнес-клуба",
        xml_data: `<?xml version="1.0" encoding="UTF-8"?><flyer><page width="800" height="500" orientation="landscape" background="#0f0f0f" /><elements><text id="2" x="50" y="60" width="700" fontSize="28" fill="#ff4500" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">ИЗМЕНИ СЕБЯ УЖЕ СЕГОДНЯ</text><text id="3" x="50" y="120" width="700" fontSize="86" fill="#ffffff" fontFamily="Impact" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">FIT ZONE</text><text id="4" x="50" y="250" width="700" fontSize="32" fill="#ff4500" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Первый месяц — БЕСПЛАТНО</text><text id="5" x="50" y="320" width="700" fontSize="22" fill="#ffffff" fontFamily="Arial" fontWeight="normal" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Тренажёрный зал • Групповые занятия • Бассейн</text><text id="6" x="50" y="420" width="700" fontSize="24" fill="#ff4500" fontFamily="Arial" fontWeight="bold" fontStyle="normal" textAlign="center" rotation="0" opacity="1">Запись: +7 (999) 000-00-00</text></elements></flyer>`
      },
    ];

    for (const tpl of defaultTemplates) {
      db.run(
        "INSERT INTO templates (name, category, description, xml_data, is_default) VALUES (?, ?, ?, ?, 1)",
        [tpl.name, tpl.category, tpl.description, tpl.xml_data]
      );
    }
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function all(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
}

module.exports = { getDb, all, get, run, saveDb };