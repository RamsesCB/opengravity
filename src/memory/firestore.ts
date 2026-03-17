import { db } from '../firebase.js';
import { logger } from '../utils/logger.js';

export class Memory {
  private getCollection(userId: string) {
    return db.collection('users').doc(userId).collection('messages');
  }

  public async addMessage(
    userId: string,
    role: string,
    content: string | null,
    name?: string,
    toolCallId?: string,
    toolCalls?: any[]
  ) {
    const data: any = {
      role,
      timestamp: new Date().toISOString()
    };
    if (content !== null) data.content = content;
    if (name) data.name = name;
    if (toolCallId) data.toolCallId = toolCallId;
    if (toolCalls) data.toolCalls = JSON.stringify(toolCalls);

    await this.getCollection(userId).add(data);
    logger.info(`Saved ${role} message to Firestore for user ${userId}`);
  }

  public async getHistory(userId: string, limit = 50): Promise<any[]> {
    const snapshot = await this.getCollection(userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
      
    const docs = snapshot.docs.reverse(); // Reverse so older items come first
    return docs.map((doc: any) => {
      const data = doc.data();
      const msg: any = { role: data.role };
      if (data.content) msg.content = data.content;
      if (data.name) msg.name = data.name;
      if (data.toolCallId) msg.tool_call_id = data.toolCallId;
      if (data.toolCalls) msg.tool_calls = JSON.parse(data.toolCalls);
      return msg;
    });

  }
}

export const memory = new Memory();
