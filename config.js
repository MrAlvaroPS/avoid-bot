const { config } = require('dotenv');

// Load environment variables
config();

module.exports = {
    token: process.env.DISCORD_TOKEN || 'your-bot-token-here',
    clientId: process.env.CLIENT_ID || 'your-client-id-here',
    guildId: process.env.GUILD_ID || 'your-guild-id-here', // Optional: for guild-specific commands
};
