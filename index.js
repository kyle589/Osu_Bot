const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let osuAccessToken = null;

// Function to get osu API access token
async function getOsuAccessToken() {
    const response = await axios.post('https://osu.ppy.sh/oauth/token', {
        client_id: process.env.OSU_CLIENT_ID,
        client_secret: process.env.OSU_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'public'
    });

    osuAccessToken = response.data.access_token;
    console.log('✅ Osu! access token acquired');
}

// Function to fetch latest score
async function getLatestScore(username) {
    if (!osuAccessToken) await getOsuAccessToken();

    try {
        // Get user ID
        const userRes = await axios.get(`https://osu.ppy.sh/api/v2/users/${username}/osu`, {
            headers: { Authorization: `Bearer ${osuAccessToken}` }
        });

        const userId = userRes.data.id;

        // Get latest score
        const scoreRes = await axios.get(`https://osu.ppy.sh/api/v2/users/${userId}/scores/recent?mode=osu&limit=1`, {
            headers: { Authorization: `Bearer ${osuAccessToken}` }
        });

        const score = scoreRes.data[0];

        if (!score) return `No recent scores found for **${username}**.`;

        const beatmapId = score.beatmap.id;

        // Get full beatmap info to access max combo
        const beatmapRes = await axios.get(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`, {
        headers: { Authorization: `Bearer ${osuAccessToken}` }
        });

        const maxCombo = beatmapRes.data.max_combo;


        const { EmbedBuilder } = require('discord.js');

        // Emojis by rank
        const rankEmojis = {
            SS: '🟨', 
            S: '🟨',
            A: '🟩',
            B: '🟦',
            C: '🟪',
            D: '🟥',
        };

        // Format numbers
        const pp = score.pp ? score.pp.toFixed(0) : '0';
        const acc = (score.accuracy * 100).toFixed(2);
        const formattedScore = score.score.toLocaleString();
        const combo = `x${score.max_combo}/${maxCombo}`;
        const mods = score.mods.length ? score.mods.join(', ') : 'No Mod';

        // Build the 2-line description
        const emoji = rankEmojis[score.rank] || '';
        const line1 = `${emoji} ${score.rank} ▷ **${pp} PP** ▷ ${acc}% acc`;
        const line2 = `${formattedScore} ▷ ${combo} ▷ ${mods}`;

        const embed = new EmbedBuilder()
            .setColor(0x7289da)
            .setAuthor({
                name: `${username}'s most recent play`,
                iconURL: userRes.data.avatar_url,
                url: `https://osu.ppy.sh/users/${userId}`
            })
            .setTitle(`${score.beatmapset.title} [${score.beatmap.version}]`)
            .setURL(`https://osu.ppy.sh/beatmaps/${score.beatmap.id}`)
            .setThumbnail(score.beatmapset.covers.cover)
            .setDescription(`${line1}\n${line2}`)
            .setFooter({ text: `Played on ${new Date(score.created_at).toLocaleString()}` });

        return { embed }; // Return an object so the bot can detect it's an embed

    } catch (err) {
        console.error(err.response?.data || err);
        return `❌ Error fetching score for **${username}**.`;
    }
}

// Handle bot ready
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Handle messages
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!osu')) {
        const args = message.content.split(' ');
        const username = args[1];

        if (!username) {
            return message.reply('Usage: `!osu <username>`');
        }

        const result = await getLatestScore(username);

        if (result.embed) {
            message.reply({ embeds: [result.embed] });
        }
        else {
            message.reply(result); // for error messages
        }
    }
});

client.login(process.env.DISCORD_TOKEN);