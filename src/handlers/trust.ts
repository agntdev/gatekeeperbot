import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { upsertMember, addAuditEntry } from "../storage.js";

const composer = new Composer<Ctx>();

composer.command("trust", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply("Usage: /trust @username");
    return;
  }

  const target = args[0];

  upsertMember(chatId, 0, { trusted: true });

  addAuditEntry({
    chatId,
    actorId,
    action: "trust",
    reason: `Trusted ${target}`,
    timestamp: Date.now(),
  });

  await ctx.reply(`User trusted. They're now exempt from verification.`);
});

export default composer;
