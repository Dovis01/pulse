import { config } from "dotenv";
config();
async function main() {
  const { getAIGate, callAI } = await import("../src/lib/ai");
  const gate = await getAIGate();
  console.log("gate:", { hasProvider: Boolean(gate.provider), reason: gate.reason, degraded: gate.degraded });
  if (gate.provider) {
    console.log("provider:", gate.provider.id, gate.provider.model);
    const out = await callAI((p) => p.translate("Hello world", "zh"));
    console.log("translate result:", out);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
