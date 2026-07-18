import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { upsertMember, addAuditEntry } from "../storage.js";

const composer = new Composer<Ctx>();

composer.command("untrust", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply("Usage: /untrust @username");
    return;
  }

  const target = args[0];

  upsertMember(chatId, 0, { trusted: false });

  addAuditEntry({
    chatId,
    actorId,
    action: "untrust",
    reason: `Removed trust from ${target}`,
    timestamp: Date.now(),
  });

  await ctx.reply(`Trust removed. They'll need to verify like everyone else.`);
});

export default composer;
