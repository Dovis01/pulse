import type { NotificationRecord } from "@/lib/news/types";

/**
 * Notification provider port (product spec §43). Implementations:
 * Telegram (realtime) and Resend (digest). All optional — a missing key
 * must simply no-op, never fail the pipeline.
 */

export interface OutgoingMessage {
  subject: string;
  body: string;
  url?: string;
  meta?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly id: NotificationRecord["channel"];
  isConfigured(): boolean;
  send(message: OutgoingMessage): Promise<boolean>;
}
