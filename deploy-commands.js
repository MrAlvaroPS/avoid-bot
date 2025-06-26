const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.js');

const commands = [];

// Grab all the command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] Loaded command for deployment: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.token);

// Deploy commands
(async () => {
    try {
        console.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

        let data;

        // Deploy commands globally (takes up to 1 hour to propagate)
        data = await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );
        console.log(`[SUCCESS] Successfully reloaded ${data.length} global application (/) commands.`);

    } catch (error) {
        console.error('[ERROR] Failed to deploy commands:', error);
    }
})();
