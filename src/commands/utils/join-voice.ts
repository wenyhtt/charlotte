import { Discord, Slash } from "discordx";
import { CommandInteraction, GuildMember } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";

@Discord()
export class Voice {
  @Slash({ name: "join", description: "Join your voice channel" })
  async join(interaction: CommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;

    if (!channel) {
      await interaction.reply({
        content: "Join a voice channel first!",
        ephemeral: true,
      });
      return;
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    await interaction.reply(`Joined ${channel.name}`);
  }
}
