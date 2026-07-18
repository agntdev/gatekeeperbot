import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addInfraction, addAuditEntry } from "../storage.js";

const composer = new Composer<Ctx>();

composer.command("warn", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply("Usage: /warn @username reason");
    return;
  }

  const target = args[0];
  const reason = args.slice(1).join(" ") || "No reason provided";

  addInfraction({
    chatId,
    actorId,
    targetId: 0,
    action: "warn",
    reason,
    timestamp: Date.now(),
  });

  addAuditEntry({
    chatId,
    actorId,
    action: "warn",
    reason: `Warned ${target}: ${reason}`,
    timestamp: Date.now(),
  });

  await ctx.reply(`User warned. Reason: ${reason}`);
});

export default composer;
