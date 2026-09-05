import type { NotificationProvider, OutgoingMessage } from "./types";

/**
 * Telegram adapter — primary realtime channel (cost spec §83, §125).
 * ⚡ BREAKING format per product spec §44.
 */

export class TelegramProvider implements NotificationProvider {
  readonly id = "telegram" as const;

  isConfigured(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
  }

  async send(message: OutgoingMessage): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) return false;

    const text = [
      `<b>${message.subject}</b>`,
      "",
      message.body,
      message.url ? `\n<a href="${message.url}">Open in Pulse</a>` : "",
    ].join("\n");

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
