const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ChatMemory {
  constructor(dbPath = './database/chatHistory.sqlite') {
    this.dbPath = dbPath;
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }
    await this.initializeDatabase();
    this.isInitialized = true;
    return true;
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        agent TEXT,
        confidence REAL,
        tfl_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES conversations (thread_id)
      );

      CREATE INDEX IF NOT EXISTS idx_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTableSQL, (err) => {
        if (err) {
          console.error('Table creation error:', err);
          reject(err);
        } else {
          console.log('Database tables created/verified');
          resolve();
        }
      });
    });
  }

  async saveMessage(
    threadId,
    role,
    content,
    agent = null,
    confidence = null,
    tflData = null,
  ) {
    const sql = `
      INSERT INTO messages (thread_id, role, content, agent, confidence, tfl_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        [
          threadId,
          role,
          content,
          agent,
          confidence,
          tflData ? JSON.stringify(tflData) : null,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        },
      );
    });
  }

  async getConversationHistory(threadId, limit = 50) {
    const sql = `
      SELECT * FROM messages 
      WHERE thread_id = ? 
      ORDER BY created_at ASC 
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [threadId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const messages = rows.map((row) => ({
            ...row,
            tfl_data: row.tfl_data ? JSON.parse(row.tfl_data) : null,
          }));
          resolve(messages);
        }
      });
    });
  }

  async createConversation(threadId) {
    const sql = `
      INSERT OR IGNORE INTO conversations (thread_id)
      VALUES (?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [threadId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async deleteConversation(threadId) {
    const deleteMessagesSQL = 'DELETE FROM messages WHERE thread_id = ?';
    const deleteConversationSQL =
      'DELETE FROM conversations WHERE thread_id = ?';

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(deleteMessagesSQL, [threadId], (err) => {
          if (err) reject(err);
        });
        this.db.run(deleteConversationSQL, [threadId], function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    });
  }

  async healthCheck() {
    try {
      if (!this.db) {
        return false;
      }

      return new Promise((resolve, reject) => {
        this.db.get('SELECT 1 as test', (err, row) => {
          if (err) {
            resolve(false);
          } else {
            resolve(row.test === 1);
          }
        });
      });
    } catch (error) {
      return false;
    }
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Database close error:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = { ChatMemory };
