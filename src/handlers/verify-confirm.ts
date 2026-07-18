import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import {
  getMember,
  upsertMember,
  removePendingVerification,
  addAuditEntry,
} from "../storage.js";

registerMainMenuItem({ label: "I'm human", data: "verify:confirm", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("verify:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) {
    await ctx.reply("Verification only works in a group chat.");
    return;
  }
  const member = getMember(chatId, userId);
  if (member?.verified) {
    await ctx.reply("You're already verified. Welcome!");
    return;
  }
  removePendingVerification(chatId, userId);
  upsertMember(chatId, userId, { verified: true });
  addAuditEntry({
    chatId,
    actorId: userId,
    targetId: userId,
    action: "verify",
    reason: "User confirmed verification",
    timestamp: Date.now(),
  });
  await ctx.reply("You're verified! You can now participate in the group.");
});

export default composer;
