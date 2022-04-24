'use strict';

// import .env file
require('dotenv').config();
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SPREADSHEET_REACTION_ID =
	process.env.GOOGLE_SPREADSHEET_REACTION_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// SpreadSheetService initialization
const SpreadSheetService = require('./spreadSheetService');
const spreadSheetService = new SpreadSheetService(GOOGLE_SPREADSHEET_ID);
const reactionService = new SpreadSheetService(GOOGLE_SPREADSHEET_REACTION_ID);
spreadSheetService.authorize(GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY);
reactionService.authorize(GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY);

// Discord Setting
const { Client, Intents } = require('discord.js');
const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS
	],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});
client.login(DISCORD_TOKEN);

client.on('ready', () => {
	console.log(`${client.user.tag}` + ' is waiting...q(〇皿〇)p');
});

client.on('messageCreate', async (message) => {
	if (message.guildId !== DISCORD_GUILD_ID) return;
	if (message.channelId !== DISCORD_CHANNEL_ID) return;
	if (message.author.bot) return;

	const date = new Date(message.createdTimestamp);

	await spreadSheetService.insert({
		id: message.id,
		PostDate:
			date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate(),
		PostTime:
			date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds(),
		PostUserName: message.author.username,
		PostText: message.content
	});
});

// Reaction User Cache
let reactionDataCache = [];

client.on('messageReactionAdd', async (reaction, user) => {
	if (reaction.message.guildId !== DISCORD_GUILD_ID) return;
	if (reaction.message.channelId !== DISCORD_CHANNEL_ID) return;
	const userId = user.id;
	const userName = user.username;
	const emoji = reaction.emoji.name;
	// キャッシュ内検索
	const targetDataIndex = reactionDataCache.findIndex(
		(data) => data.userId === userId && data.emoji === emoji
	);
	if (targetDataIndex === -1) {
		reactionDataCache.push({
			userId: userId,
			userName: userName,
			emoji: emoji,
			count: 1
		});
	} else {
		reactionDataCache[targetDataIndex].count++;
	}
});

client.on('messageReactionRemove', async (reaction, user) => {
	if (reaction.message.guildId !== DISCORD_GUILD_ID) return;
	if (reaction.message.channelId !== DISCORD_CHANNEL_ID) return;
	const userId = user.id;
	const emoji = reaction.emoji.name;
	// キャッシュ内検索
	const targetDataIndex = reactionDataCache.findIndex(
		(data) => data.userId === userId && data.emoji === emoji
	);
	if (targetDataIndex !== -1) {
		reactionDataCache[targetDataIndex].count--;
	}
});

// Job Scheduling
const cron = require('node-cron');
cron.schedule('0 0 0 * * *', () => updatePostReaction());
cron.schedule('* * * 31 * *', () => outputUserReaction());

const updatePostReaction = async () => {
	const today = new Date();
	const yesterday =
		today.getFullYear() +
		'/' +
		(today.getMonth() + 1) +
		'/' +
		(today.getDate() - 2);
	const dataList = await spreadSheetService.select();
	dataList
		.filter((data) => yesterday === data.PostDate)
		.map(async (data) => {
			const message = await client.channels.cache
				.get(DISCORD_CHANNEL_ID)
				.messages.fetch(data.ID);
			const upvoteCnt = message.reactions.cache.get('👍')?.count;
			const downvoteCnt = message.reactions.cache.get('👎')?.count;
			await spreadSheetService.updateById(data.ID, {
				UpvoteStampCount: upvoteCnt === undefined ? 0 : upvoteCnt,
				InappropriateReport: downvoteCnt === undefined ? 0 : downvoteCnt
			});
		});
};

const outputUserReaction = () => {
	console.log(reactionDataCache);
	Promise.all(
		reactionDataCache.map(async (value) => {
			await reactionService.insert(value);
		})
	).then((data) => reactionDataCache.splice(0));
};
