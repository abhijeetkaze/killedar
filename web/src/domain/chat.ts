// Chat message shape shared by the prompt builder and the LanguageModel port.

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}
