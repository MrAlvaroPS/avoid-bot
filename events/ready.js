const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`[SUCCESS] Bot ready! Logged in as ${client.user.tag}`);
        console.log(`[INFO] Bot is serving ${client.guilds.cache.size} guilds`);
        
        if (client.guilds.cache.size > 0) {
            console.log(`[INFO] Servers:`);
            client.guilds.cache.forEach(guild => {
                console.log(`  - ${guild.name} (ID: ${guild.id})`);
            });
        }
        
        // Set bot activity status
        client.user.setActivity('creando encuestas 📊', { type: 'WATCHING' });
    },
};
