import type { Conversation, Message } from "~/domain/entities/conversation";
import type { ConversationRepository } from "~/domain/repositories/conversation-repository";
import type { MessageSource } from "~/domain/entities/source";

interface D1ConversationRow {
  id: string;
  user_id: string;
  title: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface D1MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tokens_used: number | null;
  model: string | null;
  created_at: string;
}

interface D1SourceRow {
  id: string;
  message_id: string;
  source_type: string;
  ref: string;
  title: string | null;
  text_hebrew: string | null;
  text_translation: string | null;
  translation_language: string | null;
  category: string | null;
  sefaria_url: string | null;
  created_at: string;
}

function rowToConversation(row: D1ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: D1MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as Message["role"],
    content: row.content,
    tokensUsed: row.tokens_used,
    model: row.model,
    createdAt: row.created_at,
  };
}

function rowToSource(row: D1SourceRow): MessageSource {
  return {
    id: row.id,
    messageId: row.message_id,
    sourceType: row.source_type as MessageSource["sourceType"],
    ref: row.ref,
    title: row.title,
    textHebrew: row.text_hebrew,
    textTranslation: row.text_translation,
    translationLanguage: row.translation_language,
    category: row.category,
    sefariaUrl: row.sefaria_url,
    createdAt: row.created_at,
  };
}

export class D1ConversationRepository implements ConversationRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Conversation | null> {
    const row = await this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .bind(id)
      .first<D1ConversationRow>();
    return row ? rowToConversation(row) : null;
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const { results } = await this.db
      .prepare(
        "SELECT * FROM conversations WHERE user_id = ? AND archived = 0 ORDER BY updated_at DESC"
      )
      .bind(userId)
      .all<D1ConversationRow>();
    return results.map(rowToConversation);
  }

  async create(userId: string, title?: string): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        "INSERT INTO conversations (id, user_id, title, archived, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
      )
      .bind(id, userId, title ?? null, now, now)
      .run();

    const conversation = await this.findById(id);
    if (!conversation) {
      throw new Error("Failed to create conversation");
    }
    return conversation;
  }

  async update(
    id: string,
    data: Partial<Conversation>
  ): Promise<Conversation> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) {
      sets.push("title = ?");
      values.push(data.title);
    }
    if (data.archived !== undefined) {
      sets.push("archived = ?");
      values.push(data.archived ? 1 : 0);
    }

    if (sets.length === 0) {
      const conversation = await this.findById(id);
      if (!conversation) throw new Error("Conversation not found");
      return conversation;
    }

    sets.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const conversation = await this.findById(id);
    if (!conversation) throw new Error("Conversation not found");
    return conversation;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM conversations WHERE id = ?")
      .bind(id)
      .run();
  }

  async addMessage(
    conversationId: string,
    role: Message["role"],
    content: string,
    tokensUsed?: number,
    model?: string
  ): Promise<Message> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        "INSERT INTO messages (id, conversation_id, role, content, tokens_used, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(id, conversationId, role, content, tokensUsed ?? null, model ?? null, now)
      .run();

    // Update conversation's updated_at
    await this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .bind(now, conversationId)
      .run();

    const row = await this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .bind(id)
      .first<D1MessageRow>();

    if (!row) throw new Error("Failed to create message");
    return rowToMessage(row);
  }

  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const sql = limit
      ? "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
      : "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC";

    const stmt = limit
      ? this.db.prepare(sql).bind(conversationId, limit)
      : this.db.prepare(sql).bind(conversationId);

    const { results } = await stmt.all<D1MessageRow>();
    return results.map(rowToMessage);
  }

  async addSources(sources: MessageSource[]): Promise<void> {
    if (sources.length === 0) return;

    for (const source of sources) {
      await this.db
        .prepare(
          `INSERT INTO message_sources (id, message_id, source_type, ref, title, text_hebrew, text_translation, translation_language, category, sefaria_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          source.id,
          source.messageId,
          source.sourceType,
          source.ref,
          source.title,
          source.textHebrew,
          source.textTranslation,
          source.translationLanguage,
          source.category,
          source.sefariaUrl,
          source.createdAt
        )
        .run();
    }
  }

  async getSourcesForMessage(messageId: string): Promise<MessageSource[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM message_sources WHERE message_id = ?")
      .bind(messageId)
      .all<D1SourceRow>();
    return results.map(rowToSource);
  }

  async saveFeedback(messageId: string, userId: string, rating: 1 | -1): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // INSERT OR REPLACE handles the UNIQUE(message_id, user_id) constraint — updates existing vote
    await this.db
      .prepare(
        `INSERT INTO message_feedback (id, message_id, user_id, rating, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(message_id, user_id) DO UPDATE SET rating = excluded.rating`
      )
      .bind(id, messageId, userId, rating, now)
      .run();
  }
}
