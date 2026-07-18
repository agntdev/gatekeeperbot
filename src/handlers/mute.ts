import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addInfraction, addAuditEntry } from "../storage.js";

const composer = new Composer<Ctx>();

composer.command("mute", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply("Usage: /mute @username duration reason");
    return;
  }

  const target = args[0];
  const duration = args[1] || "1h";
  const reason = args.slice(2).join(" ") || "No reason provided";

  addInfraction({
    chatId,
    actorId,
    targetId: 0,
    action: "mute",
    reason,
    timestamp: Date.now(),
    expiresAt: Date.now() + parseDuration(duration),
  });

  addAuditEntry({
    chatId,
    actorId,
    action: "mute",
    reason: `Muted ${target} for ${duration}: ${reason}`,
    timestamp: Date.now(),
  });

  await ctx.reply(`User muted for ${duration}. Reason: ${reason}`);
});

function parseDuration(d: string): number {
  const m = /^(\d+)([hm])$/.exec(d);
  if (!m) return 3600000;
  const n = parseInt(m[1], 10);
  return m[2] === "h" ? n * 3600000 : n * 60000;
}

export default composer;
