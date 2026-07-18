import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { addInfraction, addAuditEntry } from "../storage.js";

const composer = new Composer<Ctx>();

composer.command("ban", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply("Usage: /ban @username reason");
    return;
  }

  const target = args[0];
  const reason = args.slice(1).join(" ") || "No reason provided";

  addInfraction({
    chatId,
    actorId,
    targetId: 0,
    action: "ban",
    reason,
    timestamp: Date.now(),
  });

  addAuditEntry({
    chatId,
    actorId,
    action: "ban",
    reason: `Banned ${target}: ${reason}`,
    timestamp: Date.now(),
  });

  await ctx.reply(`User banned. Reason: ${reason}`);
});

export default composer;
