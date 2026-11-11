/** Store full output; inline images must become durable Storage references first. */
export async function durableChatContent(content: string, upload: (mime: string, base64: string) => Promise<string>): Promise<string> {
  const pattern = /!\[([^\]]*)\]\(data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)\)/g;
  let result = "";
  let end = 0;
  for (const match of content.matchAll(pattern)) {
    result += content.slice(end, match.index);
    const path = await upload(match[2], match[3]);
    result += `![${match[1]}](ai-image://${path})`;
    end = (match.index ?? 0) + match[0].length;
  }
  return result + content.slice(end);
}

export function chatHistoryRows(userId: string, userContent: string, assistantContent: string, model: string | null, sessionId: string | null, now: number) {
  return [
    { user_id: userId, session_id: sessionId, role: "user", content: userContent, model, created_at: new Date(now).toISOString() },
    { user_id: userId, session_id: sessionId, role: "assistant", content: assistantContent, model, created_at: new Date(now + 1).toISOString() },
  ];
}