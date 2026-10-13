import { Discord, Slash, SlashOption, Guard } from "discordx";
import {
  CommandInteraction,
  AttachmentBuilder,
  ApplicationCommandOptionType,
  type Attachment,
} from "discord.js";
import { RateLimit, TIME_UNIT } from "@discordx/utilities";

import { extractZip } from "../../lib/screenshot/zip.ts";
import { renderFile } from "../../lib/screenshot/renderer.ts";
import {
  TAB_SIZE,
  DISCORD_ATTACHMENT_LIMIT,
  COOLDOWN_SECONDS,
} from "../../lib/screenshot/constants.ts";
import type { ScreenshotResult } from "../../lib/screenshot/types.ts";

/** Users who currently have a screenshot job in flight */
const activeJobs = new Set<string>();

@Discord()
export class CodeScreenshot {
  @Slash({
    name: "screenshot",
    description:
      "Render a code file (or .zip of code files) as a PNG image.",
  })
  @Guard(
    RateLimit(TIME_UNIT.seconds, COOLDOWN_SECONDS, {
      ephemeral: true,
      message: `⏳ You're on cooldown. Please wait ${COOLDOWN_SECONDS} seconds between screenshots.`,
    }),
  )
  async screenshot(
    @SlashOption({
      name: "file",
      description: "A single code file or a .zip archive (≤ 1 MB).",
      required: true,
      type: ApplicationCommandOptionType.Attachment,
    })
    file: Attachment,
    interaction: CommandInteraction,
  ): Promise<void> {
    const userId = interaction.user.id;

    // One job per user at a time
    if (activeJobs.has(userId)) {
      await interaction.reply({
        content:
          "⚙️ You already have a screenshot job running. Please wait for it to finish.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    activeJobs.add(userId);
    try {
      const results = await this.processAttachment(
        file.url,
        file.name ?? "file",
      );
      await this.sendResults(interaction, results);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      await interaction.editReply({ content: `❌ ${message}` });
    } finally {
      activeJobs.delete(userId);
    }
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async processAttachment(
    url: string,
    filename: string,
  ): Promise<ScreenshotResult[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download the attachment.");
    const buffer = Buffer.from(await res.arrayBuffer());

    if (filename.toLowerCase().endsWith(".zip")) {
      const files = extractZip(buffer);
      const all: ScreenshotResult[] = [];
      for (const f of files) {
        const pngs = await renderFile(f);
        all.push(...pngs);
      }
      return all;
    }

    // Single file
    const content = buffer
      .toString("utf-8")
      .replace(/\t/g, " ".repeat(TAB_SIZE));
    return renderFile({ filename, content });
  }

  private async sendResults(
    interaction: CommandInteraction,
    results: ScreenshotResult[],
  ): Promise<void> {
    if (results.length === 0) {
      await interaction.editReply({ content: "⚠️ No images were generated." });
      return;
    }

    const toAttachment = (r: ScreenshotResult) =>
      new AttachmentBuilder(r.png, { name: r.filename });

    // Split into batches of DISCORD_ATTACHMENT_LIMIT
    const batches: ScreenshotResult[][] = [];
    for (let i = 0; i < results.length; i += DISCORD_ATTACHMENT_LIMIT) {
      batches.push(results.slice(i, i + DISCORD_ATTACHMENT_LIMIT));
    }

    // First batch → editReply
    await interaction.editReply({
      content: `📸 Screenshot${results.length > 1 ? "s" : ""} (${results.length} image${results.length > 1 ? "s" : ""})`,
      files: batches[0]!.map(toAttachment),
    });

    // Additional batches → followUp (necessary since we already consumed editReply)
    for (let i = 1; i < batches.length; i++) {
      await interaction.followUp({
        files: batches[i]!.map(toAttachment),
      });
    }
  }
}
