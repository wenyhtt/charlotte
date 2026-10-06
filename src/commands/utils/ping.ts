import { Discord, Slash } from "discordx";
import { CommandInteraction } from "discord.js";

@Discord()
export class Ping {
  @Slash({ name: "ping", description: "Ping the bot!" })
  async ping(interaction: CommandInteraction): Promise<void> {
    await interaction.reply("Pong!");
  }
}
