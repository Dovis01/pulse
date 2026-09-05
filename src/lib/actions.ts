"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/db";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";

/** Server actions require the single-user session when auth is enabled. */
async function requireUser(): Promise<void> {
  if (isAuthEnabled() && !(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function updateInterest(formData: FormData): Promise<void> {
  await requireUser();
  const topic = String(formData.get("topic") ?? "").trim();
  const weight = Number(formData.get("weight"));
  if (!topic || Number.isNaN(weight)) return;
  const repo = await getRepository();
  await repo.setInterest(topic, Math.max(0, Math.min(1, weight)));
  revalidatePath("/settings");
  revalidatePath("/for-you");
}

export async function toggleSource(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const repo = await getRepository();
  const sources = await repo.listSources();
  const source = sources.find((s) => s.id === id);
  if (!source) return;
  await repo.saveSource({ ...source, enabled: !source.enabled });
  revalidatePath("/settings/sources");
  revalidatePath("/sources");
}
