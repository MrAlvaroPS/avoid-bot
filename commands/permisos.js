const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('permisos')
        .setDescription('Gestiona los permisos del bot de encuestas')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Establece qué roles pueden crear encuestas')
                .addStringOption(option =>
                    option.setName('roles')
                        .setDescription('Roles permitidos separados por comas (ej: oficial,admin)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('votar')
                .setDescription('Establece qué roles pueden votar en encuestas')
                .addStringOption(option =>
                    option.setName('roles')
                        .setDescription('Roles permitidos separados por comas (ej: miembro,raider,trial)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('Muestra los permisos actuales'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user has administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ Necesitas permisos de administrador para gestionar los permisos del bot.',
                    flags: 64
                });
                return;
            }

            const subcommand = interaction.options.getSubcommand();
            const fs = require('fs').promises;
            const path = require('path');
            
            // Load current permissions
            const permissionsPath = path.join(process.cwd(), 'data', 'permissions.json');
            let permissions = {
                createPoll: ['oficial', 'admin'],
                vote: ['miembro', 'raider', 'trial', 'oficial', 'admin']
            };

            try {
                const data = await fs.readFile(permissionsPath, 'utf8');
                permissions = JSON.parse(data);
            } catch (error) {
                // File doesn't exist, use defaults
            }

            if (subcommand === 'crear') {
                const rolesInput = interaction.options.getString('roles');
                const roles = rolesInput.split(',').map(role => role.trim().toLowerCase());
                
                permissions.createPoll = roles;
                
                // Ensure data directory exists
                await fs.mkdir(path.dirname(permissionsPath), { recursive: true });
                await fs.writeFile(permissionsPath, JSON.stringify(permissions, null, 2));
                
                await interaction.reply({
                    content: `✅ Permisos de creación actualizados. Roles permitidos: **${roles.join(', ')}**`,
                    flags: 64
                });

            } else if (subcommand === 'votar') {
                const rolesInput = interaction.options.getString('roles');
                const roles = rolesInput.split(',').map(role => role.trim().toLowerCase());
                
                permissions.vote = roles;
                
                // Ensure data directory exists
                await fs.mkdir(path.dirname(permissionsPath), { recursive: true });
                await fs.writeFile(permissionsPath, JSON.stringify(permissions, null, 2));
                
                await interaction.reply({
                    content: `✅ Permisos de votación actualizados. Roles permitidos: **${roles.join(', ')}**`,
                    flags: 64
                });

            } else if (subcommand === 'ver') {
                const createRoles = permissions.createPoll.join(', ');
                const voteRoles = permissions.vote.join(', ');
                
                await interaction.reply({
                    content: `**Permisos actuales:**\n\n**Crear encuestas:** ${createRoles}\n**Votar:** ${voteRoles}`,
                    flags: 64
                });
            }

        } catch (error) {
            console.error('Error managing permissions:', error);
            await interaction.reply({
                content: '❌ Hubo un error al gestionar los permisos.',
                flags: 64
            });
        }
    },
};