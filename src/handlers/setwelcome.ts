import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getSettings, updateSettings, addAuditEntry } from "../storage.js";

registerMainMenuItem({ label: "Set welcome", data: "setwelcome:show", order: 50 });

const composer = new Composer<Ctx>();

composer.command("setwelcome", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const s = getSettings(chatId);
  await ctx.reply(
    `Current welcome message:\n\n${s.welcomeMessage}\n\n` +
      `Current rules:\n${s.rulesText}\n\n` +
      `Send the new welcome message, or tap Cancel.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Cancel", "setwelcome:cancel")],
      ]),
    },
  );
  ctx.session.step = "awaiting_welcome";
});

composer.callbackQuery("setwelcome:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const s = getSettings(chatId);
  await ctx.editMessageText(
    `Current welcome message:\n\n${s.welcomeMessage}\n\n` +
      `Current rules:\n${s.rulesText}\n\n` +
      `Send the new welcome message, or tap Cancel.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Cancel", "setwelcome:cancel")],
      ]),
    },
  );
  ctx.session.step = "awaiting_welcome";
});

composer.callbackQuery("setwelcome:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.flowData = undefined;
  await ctx.editMessageText("Cancelled. Tap a button to continue.", {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_welcome") return next();
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return next();

  const newWelcome = ctx.message.text.trim();
  updateSettings(chatId, { welcomeMessage: newWelcome });
  addAuditEntry({
    chatId,
    actorId,
    action: "setwelcome",
    reason: "Updated welcome message",
    timestamp: Date.now(),
  });

  ctx.session.step = undefined;
  await ctx.reply("Welcome message updated!", {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

export default composer;
