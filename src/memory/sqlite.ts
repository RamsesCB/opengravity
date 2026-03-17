import Database from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

interface MessageRow {
  id: number;
  userId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  name?: string;
  toolCallId?: string;
  toolCalls?: string;
  timestamp: string;
}

export class Memory {
  private db: Database.Database;

  constructor() {
    this.db = new Database(config.DB_PATH);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        name TEXT,
        toolCallId TEXT,
        toolCalls TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Database initialized');
  }

  public addMessage(
    userId: string,
    role: string,
    content: string | null,
    name?: string,
    toolCallId?: string,
    toolCalls?: any[]
  ) {
    const stmt = this.db.prepare(
      'INSERT INTO messages (userId, role, content, name, toolCallId, toolCalls) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      userId,
      role,
      content,
      name || null,
      toolCallId || null,
      toolCalls ? JSON.stringify(toolCalls) : null
    );
  }

  public getHistory(userId: string, limit = 50): any[] {
    const stmt = this.db.prepare(
      'SELECT role, content, name, toolCallId, toolCalls FROM messages WHERE userId = ? ORDER BY id DESC LIMIT ?'
    );
    const rows = stmt.all(userId, limit) as MessageRow[];
    return rows.reverse().map(row => {
      const msg: any = { role: row.role };
      if (row.content !== null) msg.content = row.content;
      if (row.name) msg.name = row.name;
      if (row.toolCallId) msg.tool_call_id = row.toolCallId;
      if (row.toolCalls) msg.tool_calls = JSON.parse(row.toolCalls);
      return msg;
    });
  }
}

export const memory = new Memory();
