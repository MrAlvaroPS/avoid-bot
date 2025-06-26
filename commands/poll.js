const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const pollManager = require('../utils/pollManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('encuesta')
        .setDescription('Crea una encuesta interactiva con opciones personalizables'),

    async execute(interaction) {
        try {
            // Check permissions
            const fs = require('fs').promises;
            const path = require('path');
            
            let permissions = {
                createPoll: ['oficial', 'admin'],
                vote: ['miembro', 'raider', 'trial', 'oficial', 'admin']
            };

            try {
                const permissionsPath = path.join(process.cwd(), 'data', 'permissions.json');
                const data = await fs.readFile(permissionsPath, 'utf8');
                permissions = JSON.parse(data);
            } catch (error) {
                // Use defaults if file doesn't exist
            }

            // Check if user has permission to create polls
            const userRoles = interaction.member.roles.cache.map(role => role.name.toLowerCase());
            const hasPermission = permissions.createPoll.some(allowedRole => 
                userRoles.includes(allowedRole.toLowerCase())
            );

            if (!hasPermission) {
                await interaction.reply({
                    content: `❌ No tienes permisos para crear encuestas. Roles permitidos: **${permissions.createPoll.join(', ')}**`,
                    flags: 64
                });
                return;
            }

            // Create modal for poll creation
            const modal = new ModalBuilder()
                .setCustomId(`poll_modal_${interaction.user.id}_${Date.now()}`)
                .setTitle('Crear Nueva Encuesta');

            // Question input
            const questionInput = new TextInputBuilder()
                .setCustomId('poll_question')
                .setLabel('Pregunta de la encuesta')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('¿Cuál es tu pregunta?')
                .setRequired(true)
                .setMaxLength(200);

            // Description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('poll_description')
                .setLabel('Descripción (opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Descripción adicional para la encuesta...')
                .setRequired(false)
                .setMaxLength(500);

            // Time limit input
            const timeLimitInput = new TextInputBuilder()
                .setCustomId('poll_time_limit')
                .setLabel('Duración en días (opcional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('2')
                .setRequired(false)
                .setMaxLength(3);

            // Sections input (sections with their options)
            const sectionsInput = new TextInputBuilder()
                .setCustomId('poll_sections')
                .setLabel('Secciones y opciones')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Formato:\n[Sección 1]\nOpción A\nOpción B\n\n[Sección 2]\n:brewmaster: Tank\nDPS\nHealer')
                .setRequired(true)
                .setMaxLength(1500);

            // Voting roles input
            const votingRolesInput = new TextInputBuilder()
                .setCustomId('poll_voting_roles')
                .setLabel('Roles que pueden votar (opcional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('miembro, raider, trial, oficial, admin')
                .setRequired(false)
                .setMaxLength(200);

            // Create action rows for the modal
            const questionRow = new ActionRowBuilder().addComponents(questionInput);
            const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
            const sectionsRow = new ActionRowBuilder().addComponents(sectionsInput);
            const timeLimitRow = new ActionRowBuilder().addComponents(timeLimitInput);
            const votingRolesRow = new ActionRowBuilder().addComponents(votingRolesInput);

            // Add action rows to modal
            modal.addComponents(questionRow, descriptionRow, sectionsRow, timeLimitRow, votingRolesRow);

            // Show modal to user
            await interaction.showModal(modal);

        } catch (error) {
            console.error('Error showing poll modal:', error);
            
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Hubo un error al abrir el formulario de encuesta.',
                    flags: 64 // Ephemeral flag
                });
            }
        }
    },
};

function createPollEmbed(pollData, client) {
    const optionKeys = Object.keys(pollData.votes);
    const totalVotes = optionKeys.reduce((sum, key) => sum + (pollData.votes[key] ? pollData.votes[key].length : 0), 0);
    
    // Check if poll is expired
    const isExpired = pollData.expiresAt && new Date() > new Date(pollData.expiresAt);
    const timeLeft = pollData.expiresAt ? Math.max(0, Math.ceil((new Date(pollData.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))) : null;
    
    const embed = new EmbedBuilder()
        .setTitle(`🗳️ ${pollData.question}`)
        .setColor(isExpired ? 0x5C5C5C : 0x5865F2)
        .setAuthor({
            name: `Encuesta creada por ${pollData.author.displayName}`,
            iconURL: null
        });

    // Add description with enhanced formatting
    let description = '';
    if (pollData.description) {
        description += `*${pollData.description}*\n\n`;
    }
    
    if (isExpired) {
        description += '🔒 **Esta encuesta ha finalizado**\n';
    } else if (timeLeft !== null) {
        description += `⏰ Tiempo restante: **${timeLeft} día${timeLeft !== 1 ? 's' : ''}**\n`;
    }
    
    if (description) {
        embed.setDescription(description);
    }

    // Create dynamic columns based on votes received
    const fieldsToAdd = [];
    let columnsAdded = 0;
    
    if (pollData.options) {
        // New format with sections - organize by sections in 3 columns
        if (pollData.sections && Object.keys(pollData.sections).length > 0) {
            // Display by sections
            const sectionNames = Object.keys(pollData.sections);
            for (let i = 0; i < sectionNames.length; i += 3) {
                // Process up to 3 sections at a time
                const sectionsToShow = sectionNames.slice(i, i + 3);
                
                sectionsToShow.forEach(sectionName => {
                    const sectionOptions = pollData.sections[sectionName];
                    const sectionVotes = [];
                    
                    // Collect all votes for this section
                    sectionOptions.forEach(option => {
                        // Find the option key for this option text
                        const optionKey = Object.keys(pollData.options).find(key => 
                            pollData.options[key] === option
                        );
                        if (optionKey && pollData.votes[optionKey]) {
                            pollData.votes[optionKey].forEach(vote => {
                                let optionDisplay = option;
                                // Process Discord custom emojis
                                if (client) {
                                    optionDisplay = processCustomEmojis(optionDisplay, client);
                                }
                                sectionVotes.push({
                                    option: optionDisplay,
                                    voter: vote.displayName || vote.username
                                });
                            });
                        }
                    });
                    
                    if (sectionVotes.length > 0) {
                        const sectionContent = sectionVotes.map((vote, index) => {
                            return `${vote.option}: ${vote.voter}`;
                        }).join('\n');
                        
                        fieldsToAdd.push({
                            name: `**${sectionName}** (${sectionVotes.length})`,
                            value: sectionContent,
                            inline: true
                        });
                    } else {
                        // Show empty section placeholder
                        fieldsToAdd.push({
                            name: `**${sectionName}**`,
                            value: '*Sin votos*',
                            inline: true
                        });
                    }
                });
                
                // Add spacer after each row of 3 sections
                if (sectionsToShow.length === 3 && i + 3 < sectionNames.length) {
                    fieldsToAdd.push({
                        name: '\u200b',
                        value: '\u200b',
                        inline: false
                    });
                }
            }
        } else {
            // Fallback: show individual options that have votes
            optionKeys.forEach((optionKey) => {
                const votes = pollData.votes[optionKey] || [];
                if (votes.length > 0) {
                    let optionDisplay = pollData.options[optionKey];
                    
                    // Process Discord custom emojis
                    if (client) {
                        optionDisplay = processCustomEmojis(optionDisplay, client);
                    }
                    
                    const voterNames = votes.map((vote, index) => {
                        const name = vote.displayName || vote.username;
                        return `${index + 1}. ${name}`;
                    }).join('\n');
                    
                    fieldsToAdd.push({
                        name: `${optionDisplay} (${votes.length})`,
                        value: voterNames,
                        inline: true
                    });
                    columnsAdded++;
                    
                    if (columnsAdded % 3 === 0) {
                        fieldsToAdd.push({
                            name: '\u200b',
                            value: '\u200b',
                            inline: false
                        });
                    }
                }
            });
        }
    } else {
        // Legacy format - only show options that have votes
        const legacyOptions = {
            'si': '✅ Sí',
            'no': '❌ No', 
            'tal_vez': '🤔 Tal vez'
        };
        
        Object.keys(legacyOptions).forEach(optionKey => {
            const votes = pollData.votes[optionKey] || [];
            if (votes.length > 0) {
                const voterNames = votes.map((vote, index) => {
                    const name = vote.displayName || vote.username;
                    return `${index + 1}. ${name}`;
                }).join('\n');
                
                fieldsToAdd.push({
                    name: `${legacyOptions[optionKey]} (${votes.length})`,
                    value: voterNames,
                    inline: true
                });
                columnsAdded++;
                
                // Add spacer every 3 columns for better layout
                if (columnsAdded % 3 === 0) {
                    fieldsToAdd.push({
                        name: '\u200b',
                        value: '\u200b',
                        inline: false
                    });
                }
            }
        });
    }

    // Add all the dynamic fields
    if (fieldsToAdd.length > 0) {
        embed.addFields(...fieldsToAdd);
        
        // Add summary field
        embed.addFields({
            name: '\u200b',
            value: `📊 **Total de participantes:** ${totalVotes}`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '👥 Estado',
            value: isExpired ? 'Esta encuesta ha finalizado sin votos' : 'Aún no hay votos - ¡sé el primero en participar!',
            inline: false
        });
    }

    embed.setFooter({
        text: isExpired ? 'Encuesta finalizada' : 'Usa el menú desplegable para votar'
    }).setTimestamp(new Date(pollData.createdAt));

    return embed;
}

function processCustomEmojis(text, client) {
    if (!client) return text;
    
    return text.replace(/:([a-zA-Z0-9_]+):/g, (match, emojiName) => {
        // Search for the emoji across all guilds the bot is in
        for (const guild of client.guilds.cache.values()) {
            const emoji = guild.emojis.cache.find(e => e.name === emojiName);
            if (emoji) {
                // Return the emoji in the correct Discord format
                return `<:${emoji.name}:${emoji.id}>`;
            }
        }
        return match; // Return original if not found
    });
}

function createProgressBar(percentage) {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function getEmojiForIndex(index) {
    const emojis = ['🔸', '🔹', '🔶', '🔷', '🟡'];
    return emojis[index] || '⚪';
}
