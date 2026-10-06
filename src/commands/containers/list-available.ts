import { Discord, Slash } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { mockContainers } from "../../lib/mocks.js";

@Discord()
export class ListAvailableContainers {
  @Slash({ name: "available", description: "List all available Containers" })
  async list(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("Available Containers")
      .setColor(0x0099ff)
      .setDescription(
        mockContainers.length > 0
          ? "Here is the list of currently available:"
          : "None are currently available.",
      );

    mockContainers.forEach((container) => {
      embed.addFields({
        name: `🖥️ ${container.name} (${container.available} free)`,
        value: `RAM: ${container.ram}\nvCPU: ${container.cpu}`,
        inline: false,
      });
    });

    await interaction.reply({ embeds: [embed] });
  }
}
