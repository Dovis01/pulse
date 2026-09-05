import type { NotificationProvider, OutgoingMessage } from "./types";

/**
 * Resend adapter — email digests (cost spec §81, §127). Optional; free tier.
 */

export class ResendProvider implements NotificationProvider {
  readonly id = "email" as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim() && process.env.EMAIL_TO?.trim(),
    );
  }

  async send(message: OutgoingMessage): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const to = process.env.EMAIL_TO?.trim();
    if (!apiKey || !from || !to) return false;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          from,
          to: to.split(",").map((t) => t.trim()).filter(Boolean),
          subject: message.subject,
          html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;line-height:1.6;color:#181817">${message.body}</div>`,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
