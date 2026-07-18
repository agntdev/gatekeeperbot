import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getSettings, updateSettings, addAuditEntry } from "../storage.js";

registerMainMenuItem({ label: "Auto settings", data: "setauto:show", order: 55 });

const composer = new Composer<Ctx>();

composer.command("setauto", async (ctx) => {
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return;

  const s = getSettings(chatId);
  await ctx.reply(
    `Current auto-moderation settings:\n\n` +
      `Verification timeout: ${s.verificationTimeoutSec}s\n` +
      `Spam threshold: ${s.spamThreshold} messages\n` +
      `Auto action: ${s.autoAction}\n\n` +
      `Send the new setting (e.g. "timeout 600" or "action mute"), or tap Cancel.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Cancel", "setauto:cancel")],
      ]),
    },
  );
  ctx.session.step = "awaiting_auto";
});

composer.callbackQuery("setauto:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const s = getSettings(chatId);
  await ctx.editMessageText(
    `Current auto-moderation settings:\n\n` +
      `Verification timeout: ${s.verificationTimeoutSec}s\n` +
      `Spam threshold: ${s.spamThreshold} messages\n` +
      `Auto action: ${s.autoAction}\n\n` +
      `Send the new setting (e.g. "timeout 600" or "action mute"), or tap Cancel.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Cancel", "setauto:cancel")],
      ]),
    },
  );
  ctx.session.step = "awaiting_auto";
});

composer.callbackQuery("setauto:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.flowData = undefined;
  await ctx.editMessageText("Cancelled. Tap a button to continue.", {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_auto") return next();
  const chatId = ctx.chat?.id;
  const actorId = ctx.from?.id;
  if (!chatId || !actorId) return next();

  const input = ctx.message.text.trim().toLowerCase();

  if (input.startsWith("timeout ")) {
    const val = parseInt(input.split(/\s+/)[1] ?? "", 10);
    if (isNaN(val) || val < 30 || val > 3600) {
      await ctx.reply("Timeout must be 30-3600 seconds. Try again or tap Cancel.");
      return;
    }
    updateSettings(chatId, { verificationTimeoutSec: val });
    addAuditEntry({
      chatId,
      actorId,
      action: "setauto",
      reason: `Set verification timeout to ${val}s`,
      timestamp: Date.now(),
    });
    ctx.session.step = undefined;
    await ctx.reply(`Verification timeout set to ${val}s.`, {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
  } else if (input.startsWith("threshold ")) {
    const val = parseInt(input.split(/\s+/)[1] ?? "", 10);
    if (isNaN(val) || val < 2 || val > 50) {
      await ctx.reply("Spam threshold must be 2-50. Try again or tap Cancel.");
      return;
    }
    updateSettings(chatId, { spamThreshold: val });
    addAuditEntry({
      chatId,
      actorId,
      action: "setauto",
      reason: `Set spam threshold to ${val}`,
      timestamp: Date.now(),
    });
    ctx.session.step = undefined;
    await ctx.reply(`Spam threshold set to ${val}.`, {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
  } else if (input.startsWith("action ")) {
    const val = input.split(/\s+/)[1] as string;
    if (!["warn", "mute", "kick", "ban"].includes(val)) {
      await ctx.reply("Auto action must be: warn, mute, kick, or ban. Try again or tap Cancel.");
      return;
    }
    updateSettings(chatId, { autoAction: val as "warn" | "mute" | "kick" | "ban" });
    addAuditEntry({
      chatId,
      actorId,
      action: "setauto",
      reason: `Set auto action to ${val}`,
      timestamp: Date.now(),
    });
    ctx.session.step = undefined;
    await ctx.reply(`Auto action set to ${val}.`, {
      reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
    });
  } else {
    await ctx.reply(
      "I didn't understand that. Use:\n" +
        '"timeout 600" - set verification timeout\n' +
        '"threshold 10" - set spam threshold\n' +
        '"action mute" - set auto action\n\n' +
        "Or tap Cancel.",
    );
  }
});

export default composer;
