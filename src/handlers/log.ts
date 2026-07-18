import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { getAuditLog } from "../storage.js";

registerMainMenuItem({ label: "📋 Audit log", data: "log:show", order: 40 });

const composer = new Composer<Ctx>();

composer.command("log", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const limit = Math.min(Math.max(parseInt(args[0] ?? "10", 10) || 10, 1), 50);

  const entries = getAuditLog(chatId, limit);
  if (entries.length === 0) {
    await ctx.reply("No moderation actions logged yet.");
    return;
  }

  const lines = entries.map((e, i) => `${i + 1}. ${e.action}: ${e.reason}`);
  await ctx.reply(`Last ${entries.length} moderation actions:\n\n${lines.join("\n")}`);
});

composer.callbackQuery("log:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const entries = getAuditLog(chatId, 10);
  if (entries.length === 0) {
    await ctx.editMessageText("No moderation actions logged yet.", {
      reply_markup: { inline_keyboard: [[{ text: "Back to menu", callback_data: "menu:main" }]] },
    });
    return;
  }

  const lines = entries.map((e, i) => `${i + 1}. ${e.action}: ${e.reason}`);
  await ctx.editMessageText(`Last ${entries.length} moderation actions:\n\n${lines.join("\n")}`, {
    reply_markup: { inline_keyboard: [[{ text: "Back to menu", callback_data: "menu:main" }]] },
  });
});

export default composer;
