import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { countByAction, countJoins } from "../storage.js";

registerMainMenuItem({ label: "📊 Stats", data: "stats:show", order: 45 });

const composer = new Composer<Ctx>();

composer.command("stats", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
  const period = args[0] ?? "24h";
  const sinceMs = parsePeriod(period);

  const joins = countJoins(chatId, sinceMs);
  const actions = countByAction(chatId, sinceMs);

  const lines = [`Stats for the last ${period}:`, "", `Joins: ${joins}`];
  if (Object.keys(actions).length > 0) {
    lines.push("");
    lines.push("Moderation actions:");
    for (const [action, count] of Object.entries(actions)) {
      lines.push(`  ${action}: ${count}`);
    }
  } else {
    lines.push("Moderation actions: none");
  }

  await ctx.reply(lines.join("\n"));
});

composer.callbackQuery("stats:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const joins = countJoins(chatId, sinceMs);
  const actions = countByAction(chatId, sinceMs);

  const lines = ["Stats for the last 24h:", "", `Joins: ${joins}`];
  if (Object.keys(actions).length > 0) {
    lines.push("");
    lines.push("Moderation actions:");
    for (const [action, count] of Object.entries(actions)) {
      lines.push(`  ${action}: ${count}`);
    }
  } else {
    lines.push("Moderation actions: none");
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: { inline_keyboard: [[{ text: "Back to menu", callback_data: "menu:main" }]] },
  });
});

function parsePeriod(p: string): number {
  const m = /^(\d+)([hdw])$/.exec(p);
  if (!m) return 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    case "w":
      return n * 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export default composer;
