import "dotenv/config";
import "reflect-metadata";
import { Client } from "discordx";
import { importx, dirname } from "@discordx/importer";
import { Events, GatewayIntentBits } from "discord.js";
import { token, botId, guildId } from "./config/env.ts";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  botId: botId,
  botGuilds: [guildId],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  // Init slash commands
  await client.initApplicationCommands();
  console.log("Initialized slash commands!");
});

client.on("interactionCreate", (interaction) => {
  // Route slash command interaction to match decorator method
  client.executeInteraction(interaction);
});

async function run() {
  await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);
  // Log in to Discord with your client's token
  await client.login(token);
}

run();
