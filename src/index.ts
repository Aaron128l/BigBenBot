import { Client, GatewayIntentBits, type Snowflake } from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
		entersState,
		VoiceConnectionStatus
} from '@discordjs/voice';
import path from 'node:path';
import cron from 'node-cron';

const { TOKEN, VOICE_CHANNEL_ID, GUILD_ID, PLAY_NOW } = process.env;

if (!TOKEN || !VOICE_CHANNEL_ID || !GUILD_ID) {
	throw new Error("Missing .env items")
}

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const AUDIO_FILE_PATH = path.join(import.meta.dir, 'bigben.mp3');

async function playAudioInChannel() {
	try {
			const guild = await client.guilds.fetch(GUILD_ID as Snowflake);
			const channel = await guild.channels.fetch(VOICE_CHANNEL_ID as Snowflake);

			if (!channel || !channel.isVoiceBased()) {
					console.error('Specified channel is not a voice channel.');
					return;
			}

			// Join the voice channel
			const connection = joinVoiceChannel({
					channelId: channel.id,
					guildId: guild.id,
					adapterCreator: guild.voiceAdapterCreator,
			});

			try {
				await entersState(connection, VoiceConnectionStatus.Ready, 10_000)
			} catch (error) {
				connection.destroy()
				throw error
			}

			// Create an audio player
			const player = createAudioPlayer({
					behaviors: {
							noSubscriber: NoSubscriberBehavior.Stop,
					},
			});

			const resource = createAudioResource(AUDIO_FILE_PATH);
			player.play(resource);

			entersState(player, AudioPlayerStatus.Playing, 8_000)

			connection.subscribe(player);

			player.on(AudioPlayerStatus.Idle, () => {
				connection.destroy();
			});

			player.on('error', (error) => {
					console.error(`Audio player error: ${error.message}`);
					connection.destroy();
			});

	} catch (error) {
			console.error(`Error in playAudioInChannel: ${error}`);
	}
}


client.once('ready', async () => {
	if (!client.user) {
		throw new Error("User doesn't exist.")
	}
	console.log(`Logged in as ${client.user.tag}!`);

	// Schedule the task to run at the top of every hour
	cron.schedule('0 * * * *', () => {
			console.log('Running scheduled task: playAudioInChannel');
			playAudioInChannel();
	});


	// Bad idea...
	if (PLAY_NOW?.toLowerCase() === "true") {
		playAudioInChannel();
	}
});

client.login(TOKEN);
