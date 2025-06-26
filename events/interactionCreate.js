const { Events } = require("discord.js");
const { AttachmentBuilder } = require("discord.js");
const pollManager = require("../utils/pollManager.js");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(
                interaction.commandName,
            );

            if (!command) {
                console.error(
                    `No command matching ${interaction.commandName} was found.`,
                );
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(
                    `Error executing ${interaction.commandName}:`,
                    error,
                );

                const errorMessage = {
                    content: "❌ Hubo un error al ejecutar este comando.",
                    ephemeral: true,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Handle button interactions (poll votes)
        else if (interaction.isButton()) {
            const customId = interaction.customId;

            // Check if this is a poll vote button
            if (customId.startsWith("poll_vote_")) {
                try {
                    await handlePollVote(interaction);
                } catch (error) {
                    console.error("Error handling poll vote:", error);

                    if (!interaction.replied) {
                        await interaction.reply({
                            content:
                                "❌ Hubo un error al procesar tu voto. Por favor, inténtalo de nuevo.",
                            flags: 64, // Ephemeral flag
                        });
                    }
                }
            }
            // Handle export button
            else if (customId.startsWith("export_poll_")) {
                try {
                    await handlePollExport(interaction);
                } catch (error) {
                    console.error("Error handling poll export:", error);

                    if (!interaction.replied) {
                        await interaction.reply({
                            content:
                                "❌ Hubo un error al exportar la encuesta.",
                            flags: 64,
                        });
                    }
                }
            }
        }

        // Handle select menu interactions (poll votes)
        else if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // Check if this is a poll vote select menu
            if (
                customId.startsWith("poll_select_") ||
                customId.startsWith("poll_section_")
            ) {
                try {
                    await handlePollSelectVote(interaction);
                } catch (error) {
                    console.error("Error handling poll select vote:", error);

                    if (!interaction.replied) {
                        await interaction.reply({
                            content:
                                "❌ Hubo un error al procesar tu voto. Por favor, inténtalo de nuevo.",
                            flags: 64, // Ephemeral flag
                        });
                    }
                }
            }
        }

        // Handle modal submissions (poll creation)
        else if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            // Check if this is a poll creation modal
            if (customId.startsWith("poll_modal_")) {
                try {
                    await handlePollModalSubmit(interaction);
                } catch (error) {
                    console.error("Error handling poll modal submit:", error);

                    if (!interaction.replied) {
                        await interaction.reply({
                            content:
                                "❌ Hubo un error al crear la encuesta. Por favor, inténtalo de nuevo.",
                            flags: 64, // Ephemeral flag
                        });
                    }
                }
            }
        }
    },
};

async function handlePollModalSubmit(interaction) {
    const question = interaction.fields.getTextInputValue("poll_question");
    const description =
        interaction.fields.getTextInputValue("poll_description") || "";
    const timeLimitText =
        interaction.fields.getTextInputValue("poll_time_limit") || "2";
    const sectionsText = interaction.fields.getTextInputValue("poll_sections");
    const votingRolesText =
        interaction.fields.getTextInputValue("poll_voting_roles") || "";

    // Parse time limit
    let timeLimitDays = parseInt(timeLimitText) || 2;
    if (timeLimitDays < 1) timeLimitDays = 1;
    if (timeLimitDays > 30) timeLimitDays = 30;

    const expiresAt = new Date(
        Date.now() + timeLimitDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Parse custom voting roles
    let customVotingRoles = [];
    if (votingRolesText.trim()) {
        customVotingRoles = votingRolesText
            .split(",")
            .map((role) => role.trim().toLowerCase())
            .filter((role) => role.length > 0);
    }

    // Parse sections and options
    const sections = {};
    const optionsArray = [];
    let currentSection = "General";

    const lines = sectionsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    for (const line of lines) {
        if (line.startsWith("[") && line.endsWith("]")) {
            // New section
            currentSection = line.slice(1, -1).trim();
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
        } else {
            // Option for current section
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            sections[currentSection].push(line);
            optionsArray.push(line);
        }
    }

    // Limit to 50 options total
    if (optionsArray.length > 50) {
        optionsArray.splice(50);
    }

    if (optionsArray.length < 2) {
        await interaction.reply({
            content:
                "❌ Necesitas al menos 2 opciones para crear una encuesta.",
            flags: 64, // Ephemeral flag
        });
        return;
    }

    // Create poll data
    const pollId = `poll_${interaction.user.id}_${Date.now()}`;
    const options = {};
    const votes = {};

    optionsArray.forEach((option, index) => {
        const optionKey = `option${index}`;
        options[optionKey] = option;
        votes[optionKey] = [];
    });

    const pollData = {
        id: pollId,
        question: question,
        description: description,
        sections: sections,
        author: {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName:
                interaction.user.displayName || interaction.user.username,
        },
        options: options,
        votes: votes,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt,
        timeLimitDays: timeLimitDays,
        channelId: interaction.channelId,
        messageId: null,
        customVotingRoles: customVotingRoles,
    };

    // Create embed with user roles for export functionality
    const userRoles = interaction.member.roles.cache.map((role) =>
        role.name.toLowerCase(),
    );
    const embed = createPollEmbed(pollData, interaction.client, userRoles);

    // Create dropdown menus for voting - one per section
    const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

    const actionRows = [];

    if (sections && Object.keys(sections).length > 0) {
        // Create one dropdown per section
        Object.keys(sections).forEach((sectionName, sectionIndex) => {
            if (sectionIndex >= 5) return; // Discord allows max 5 action rows

            const sectionOptions = sections[sectionName];
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`poll_section_${sectionIndex}_${pollId}`)
                .setPlaceholder(
                    `${sectionName.replace(/:([a-zA-Z0-9_]+):/g, "").trim()}...`,
                )
                .setMinValues(1)
                .setMaxValues(1);

            const selectOptions = [];
            sectionOptions.forEach((option) => {
                // Find the option key for this option text
                const optionIndex = optionsArray.indexOf(option);
                if (optionIndex !== -1) {
                    const optionKey = `option${optionIndex}`;

                    // Remove emoji syntax for display in select menu (only show text)
                    let displayOption = option
                        .replace(/:([a-zA-Z0-9_]+):/g, "")
                        .trim();

                    // Skip empty options
                    if (displayOption.length > 0) {
                        selectOptions.push({
                            label:
                                displayOption.length > 100
                                    ? displayOption.substring(0, 97) + "..."
                                    : displayOption,
                            value: optionKey,
                        });
                    }
                }
            });

            if (selectOptions.length > 0) {
                selectMenu.addOptions(selectOptions);
                const selectRow = new ActionRowBuilder().addComponents(
                    selectMenu,
                );
                actionRows.push(selectRow);
            }
        });
    } else {
        // Fallback: single dropdown for all options
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`poll_select_${pollId}`)
            .setPlaceholder("Selecciona tu opción...")
            .setMinValues(1)
            .setMaxValues(1);

        const selectOptions = [];
        for (let i = 0; i < Math.min(optionsArray.length, 25); i++) {
            let option = optionsArray[i];
            const optionKey = `option${i}`;

            let displayOption = option.replace(/:([a-zA-Z0-9_]+):/g, "").trim();

            selectOptions.push({
                label:
                    displayOption.length > 100
                        ? displayOption.substring(0, 97) + "..."
                        : displayOption,
                value: optionKey,
            });
        }

        selectMenu.addOptions(selectOptions);
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        actionRows.push(selectRow);
    }

    // If there are more than 25 options, show a message
    let additionalMessage = "";
    if (optionsArray.length > 25) {
        additionalMessage = `⚠️ Solo se muestran las primeras 25 opciones en el menú. Total de opciones: ${optionsArray.length}`;
    }

    // Add small export button for users with "oficial" role
    if (userRoles.includes("oficial")) {
        const { ButtonBuilder, ButtonStyle } = require("discord.js");
        const exportButton = new ButtonBuilder()
            .setCustomId(`export_poll_${pollId}`)
            .setLabel("📊 Exportar")
            .setStyle(ButtonStyle.Secondary);

        const exportRow = new ActionRowBuilder().addComponents(exportButton);
        actionRows.push(exportRow);
    }

    // Send the poll
    const response = await interaction.reply({
        content: additionalMessage || undefined,
        embeds: [embed],
        components: actionRows,
        fetchReply: true,
    });

    // Save poll data with message ID
    pollData.messageId = response.id;
    await pollManager.savePoll(pollData);

    console.log(
        `[INFO] Poll created: ${pollId} with ${optionsArray.length} options by ${interaction.user.username}`,
    );
}

async function handlePollVote(interaction) {
    const customId = interaction.customId;
    const parts = customId.split("_");

    if (parts.length < 4) {
        throw new Error("Invalid button custom ID format");
    }

    const voteOption = parts[2]; // 'option1', 'option2', etc. or legacy 'si', 'no', 'tal_vez'
    const pollId = parts.slice(3).join("_"); // Reconstruct poll ID

    // Load poll data
    const pollData = await pollManager.loadPoll(pollId);

    if (!pollData) {
        await interaction.reply({
            content: "❌ Esta encuesta ya no existe o ha expirado.",
            flags: 64, // Ephemeral flag
        });
        return;
    }

    const userId = interaction.user.id;
    const userInfo = {
        id: userId,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
    };

    // Remove user's previous vote from all options
    Object.keys(pollData.votes).forEach((option) => {
        if (Array.isArray(pollData.votes[option])) {
            pollData.votes[option] = pollData.votes[option].filter(
                (vote) => vote.id !== userId,
            );
        }
    });

    // Add new vote
    if (pollData.votes[voteOption]) {
        pollData.votes[voteOption].push(userInfo);
    }

    // Save updated poll data
    await pollManager.savePoll(pollData);

    // Update the embed
    const updatedEmbed = createPollEmbed(pollData, interaction.client);

    await interaction.update({
        embeds: [updatedEmbed],
        components: interaction.message.components,
    });

    console.log(
        `[INFO] Vote recorded: ${interaction.user.username} voted ${voteOption} on poll ${pollId}`,
    );
}

async function handlePollSelectVote(interaction) {
    const customId = interaction.customId;
    const parts = customId.split("_");

    let pollId;
    if (customId.startsWith("poll_section_")) {
        // Format: poll_section_{sectionIndex}_{pollId}
        if (parts.length < 4) {
            throw new Error("Invalid section select menu custom ID format");
        }
        pollId = parts.slice(3).join("_"); // Reconstruct poll ID
    } else {
        // Format: poll_select_{pollId}
        if (parts.length < 3) {
            throw new Error("Invalid select menu custom ID format");
        }
        pollId = parts.slice(2).join("_"); // Reconstruct poll ID
    }

    const voteOption = interaction.values[0]; // Selected option

    // Load poll data to check custom voting roles
    const pollData = await pollManager.loadPoll(pollId);
    if (!pollData) {
        await interaction.reply({
            content: "❌ Esta encuesta ya no existe.",
            flags: 64,
        });
        return;
    }

    // Check voting permissions - use custom roles if specified, otherwise use global permissions
    let allowedVotingRoles = [];

    if (pollData.customVotingRoles && pollData.customVotingRoles.length > 0) {
        // Use poll-specific custom voting roles
        allowedVotingRoles = pollData.customVotingRoles;
    } else {
        // Use global permissions
        const fs = require("fs").promises;
        const path = require("path");

        let permissions = {
            createPoll: ["oficial", "admin"],
            vote: ["miembro", "raider", "trial", "oficial", "admin"],
        };

        try {
            const permissionsPath = path.join(
                process.cwd(),
                "data",
                "permissions.json",
            );
            const data = await fs.readFile(permissionsPath, "utf8");
            permissions = JSON.parse(data);
        } catch (error) {
            // Use defaults if file doesn't exist
        }

        allowedVotingRoles = permissions.vote;
    }

    // Check if user has permission to vote
    const userRoles = interaction.member.roles.cache.map((role) =>
        role.name.toLowerCase(),
    );
    const canVote = allowedVotingRoles.some((allowedRole) =>
        userRoles.includes(allowedRole.toLowerCase()),
    );

    if (!canVote) {
        const rolesList = allowedVotingRoles.join(", ");
        await interaction.reply({
            content: `❌ No tienes permisos para votar. Roles permitidos: **${rolesList}**`,
            flags: 64,
        });
        return;
    }

    // Poll data already loaded above for permission checking

    // Check if poll is expired
    const isExpired =
        pollData.expiresAt && new Date() > new Date(pollData.expiresAt);
    if (isExpired) {
        await interaction.reply({
            content: "❌ Esta encuesta ha finalizado y ya no acepta votos.",
            flags: 64, // Ephemeral flag
        });
        return;
    }

    const userId = interaction.user.id;
    const userInfo = {
        id: userId,
        username: interaction.user.username,
        displayName: interaction.user.displayName || interaction.user.username,
    };

    // Remove user's previous vote from all options
    Object.keys(pollData.votes).forEach((option) => {
        if (Array.isArray(pollData.votes[option])) {
            pollData.votes[option] = pollData.votes[option].filter(
                (vote) => vote.id !== userId,
            );
        }
    });

    // Add new vote
    if (pollData.votes[voteOption]) {
        pollData.votes[voteOption].push(userInfo);
    }

    // Save updated poll data
    await pollManager.savePoll(pollData);

    // Update the embed
    const updatedEmbed = createPollEmbed(pollData, interaction.client);

    await interaction.update({
        embeds: [updatedEmbed],
        components: interaction.message.components,
    });

    console.log(
        `[INFO] Vote recorded: ${interaction.user.username} voted ${voteOption} on poll ${pollId}`,
    );
}

function createPollEmbed(pollData, client, userRoles = []) {
    const { EmbedBuilder } = require("discord.js");

    const optionKeys = Object.keys(pollData.votes);
    const embedTotalVotes = optionKeys.reduce(
        (sum, key) =>
            sum + (pollData.votes[key] ? pollData.votes[key].length : 0),
        0,
    );

    // Check if poll is expired
    const isExpired =
        pollData.expiresAt && new Date() > new Date(pollData.expiresAt);
    const timeLeft = pollData.expiresAt
        ? Math.max(
              0,
              Math.ceil(
                  (new Date(pollData.expiresAt) - new Date()) /
                      (1000 * 60 * 60 * 24),
              ),
          )
        : null;

    const embed = new EmbedBuilder()
        .setTitle(`🗳️ ${pollData.question}`)
        .setColor(isExpired ? 0x5c5c5c : 0x5865f2);

    // Add description with export link for users with "oficial" role
    let description = "";
    if (pollData.description) {
        description += `*${pollData.description}*`;
    }

    // Export functionality will be added as a small button below the poll

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

                sectionsToShow.forEach((sectionName) => {
                    const sectionOptions = pollData.sections[sectionName];
                    const sectionVotes = [];

                    // Collect all votes for this section
                    sectionOptions.forEach((option) => {
                        // Find the option key for this option text
                        const optionKey = Object.keys(pollData.options).find(
                            (key) => pollData.options[key] === option,
                        );
                        if (optionKey && pollData.votes[optionKey]) {
                            pollData.votes[optionKey].forEach((vote) => {
                                let optionDisplay = option;
                                // Process Discord custom emojis
                                if (client) {
                                    optionDisplay = processCustomEmojis(
                                        optionDisplay,
                                        client,
                                    );
                                }
                                sectionVotes.push({
                                    option: optionDisplay,
                                    voter: vote.displayName || vote.username,
                                });
                            });
                        }
                    });

                    if (sectionVotes.length > 0) {
                        // Group votes by emoji and show only emoji + voter names
                        const votesByEmoji = {};
                        sectionVotes.forEach((vote) => {
                            // Extract only emoji part (Discord custom emoji format or Unicode emoji)
                            const emojiMatch = vote.option.match(
                                /^(<:[a-zA-Z0-9_]+:\d+>|[\u{1F600}-\u{1F6FF}]|[\u2600-\u27BF])/u,
                            );
                            const voteEmoji = emojiMatch ? emojiMatch[0] : "•";

                            if (!votesByEmoji[voteEmoji]) {
                                votesByEmoji[voteEmoji] = [];
                            }
                            votesByEmoji[voteEmoji].push(vote.voter);
                        });

                        const sectionContent = Object.entries(votesByEmoji)
                            .map(([emoji, voters]) => {
                                return voters
                                    .map((voter) => `${emoji} ${voter}`)
                                    .join("\n");
                            })
                            .join("\n");

                        // For section headers, remove emoji syntax and show only text
                        const header = processCustomEmojis(
                            sectionName,
                            client,
                        ).trim();

                        fieldsToAdd.push({
                            name: `**${header}** (${sectionVotes.length})`,
                            value: sectionContent,
                            inline: true,
                        });
                    } else {
                        // Show empty section placeholder with clean text only
                        let cleanSectionName = sectionName
                            .replace(/:[a-zA-Z0-9_]+:/g, "")
                            .trim();

                        fieldsToAdd.push({
                            name: `**${cleanSectionName}**`,
                            value: "*Sin votos*",
                            inline: true,
                        });
                    }
                });

                // Add spacer after each row of 3 sections
                if (
                    sectionsToShow.length === 3 &&
                    i + 3 < sectionNames.length
                ) {
                    fieldsToAdd.push({
                        name: "\u200b",
                        value: "\u200b",
                        inline: false,
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
                        optionDisplay = processCustomEmojis(
                            optionDisplay,
                            client,
                        );
                    }

                    const voterNames = votes
                        .map((vote, index) => {
                            const name = vote.displayName || vote.username;
                            return `${index + 1}. ${name}`;
                        })
                        .join("\n");

                    fieldsToAdd.push({
                        name: `${optionDisplay} (${votes.length})`,
                        value: voterNames,
                        inline: true,
                    });
                    columnsAdded++;

                    if (columnsAdded % 3 === 0) {
                        fieldsToAdd.push({
                            name: "\u200b",
                            value: "\u200b",
                            inline: false,
                        });
                    }
                }
            });
        }
    } else {
        // Legacy format - only show options that have votes
        const legacyOptions = {
            si: "✅ Sí",
            no: "❌ No",
            tal_vez: "🤔 Tal vez",
        };

        Object.keys(legacyOptions).forEach((optionKey) => {
            const votes = pollData.votes[optionKey] || [];
            if (votes.length > 0) {
                const voterNames = votes
                    .map((vote, index) => {
                        const name = vote.displayName || vote.username;
                        return `${index + 1}. ${name}`;
                    })
                    .join("\n");

                fieldsToAdd.push({
                    name: `${legacyOptions[optionKey]} (${votes.length})`,
                    value: voterNames,
                    inline: true,
                });
                columnsAdded++;

                // Add spacer every 3 columns for better layout
                if (columnsAdded % 3 === 0) {
                    fieldsToAdd.push({
                        name: "\u200b",
                        value: "\u200b",
                        inline: false,
                    });
                }
            }
        });
    }

    // Add all the dynamic fields
    if (fieldsToAdd.length > 0) {
        embed.addFields(...fieldsToAdd);
    } else {
        embed.addFields({
            name: "👥 Estado",
            value: isExpired
                ? "Esta encuesta ha finalizado sin votos"
                : "Aún no hay votos - ¡sé el primero en participar!",
            inline: false,
        });
    }

    // Add footer with time, participants info, and export link for "oficial" users
    const pollTotalVotes = Object.values(pollData.votes).reduce(
        (sum, votes) => sum + votes.length,
        0,
    );
    let footerText = `Total de participantes: ${pollTotalVotes}`;

    if (isExpired) {
        footerText += " • 🔒 Esta encuesta ha finalizada";
    } else if (timeLeft !== null) {
        footerText += ` • ⏰ Tiempo restante: ${timeLeft} día${timeLeft !== 1 ? "s" : ""}`;
    }

    // Add export text for users with "oficial" role
    if (userRoles.includes("oficial")) {
        footerText += " • 📊 Exportar datos";
    }

    embed
        .setFooter({ text: footerText })
        .setTimestamp(new Date(pollData.createdAt));

    return embed;
}

function processCustomEmojis(text, client) {
    if (!client) return text;

    return text.replace(/:([a-zA-Z0-9_]+):/g, (match, emojiName) => {
        // Search for the emoji across all guilds the bot is in
        for (const guild of client.guilds.cache.values()) {
            const emoji = guild.emojis.cache.find((e) => e.name === emojiName);
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

    return "█".repeat(filledBars) + "░".repeat(emptyBars);
}

function getEmojiForIndex(index) {
    const emojis = ["🔸", "🔹", "🔶", "🔷", "🟡"];
    return emojis[index] || "⚪";
}

async function handlePollExport(interaction) {
    // Check if user has "oficial" role
    const userRoles = interaction.member.roles.cache.map((role) =>
        role.name.toLowerCase(),
    );
    if (!userRoles.includes("oficial")) {
        await interaction.reply({
            content:
                '❌ Solo usuarios con rol "oficial" pueden exportar encuestas.',
            flags: 64,
        });
        return;
    }

    const pollId = interaction.customId.replace("export_poll_", "");
    const pollData = await pollManager.loadPoll(pollId);

    if (!pollData) {
        await interaction.reply({
            content: "❌ Esta encuesta ya no existe.",
            flags: 64,
        });
        return;
    }

    await interaction.deferReply({ flags: 64 });

    try {
        // Create CSV content with sections as columns
        if (pollData.sections && Object.keys(pollData.sections).length > 0) {
            // Get all section names for headers
            const sectionNames = Object.keys(pollData.sections);

            // Create header row with section names
            let csvContent =
                sectionNames
                    .map(
                        (name) =>
                            `"${name.replace(/:[a-zA-Z0-9_]+:/g, "").trim()}"`,
                    )
                    .join(",") + "\n";

            // Get all voters across all sections
            const allVoters = new Set();
            sectionNames.forEach((sectionName) => {
                const sectionOptions = pollData.sections[sectionName];
                sectionOptions.forEach((option) => {
                    const optionKey = Object.keys(pollData.options).find(
                        (key) => pollData.options[key] === option,
                    );
                    if (optionKey && pollData.votes[optionKey]) {
                        pollData.votes[optionKey].forEach((vote) => {
                            allVoters.add(vote.username);
                        });
                    }
                });
            });

            // For each voter, create a row showing their choices in each section
            Array.from(allVoters).forEach((voterName) => {
                const rowData = [];

                sectionNames.forEach((sectionName) => {
                    const sectionOptions = pollData.sections[sectionName];
                    let voterChoice = "";

                    // Find what this voter chose in this section
                    sectionOptions.forEach((option) => {
                        const optionKey = Object.keys(pollData.options).find(
                            (key) => pollData.options[key] === option,
                        );
                        if (optionKey && pollData.votes[optionKey]) {
                            const vote = pollData.votes[optionKey].find(
                                (v) => v.username === voterName,
                            );
                            if (vote) {
                                voterChoice = option
                                    .replace(/:[a-zA-Z0-9_]+:/g, "")
                                    .trim();
                            }
                        }
                    });

                    rowData.push(`"${voterChoice}"`);
                });

                csvContent += rowData.join(",") + "\n";
            });
        } else {
            // Fallback for polls without sections
            let csvContent = "Opcion,Votante\n";

            Object.keys(pollData.options).forEach((optionKey) => {
                const option = pollData.options[optionKey];
                const votes = pollData.votes[optionKey] || [];

                if (votes.length > 0) {
                    votes.forEach((vote) => {
                        const cleanOption = option
                            .replace(/:[a-zA-Z0-9_]+:/g, "")
                            .trim();
                        csvContent += `"${cleanOption}","${vote.username}"\n`;
                    });
                }
            });
        }

        // Create file attachment
        // Crea un buffer directamente desde el string CSV
        const buffer = Buffer.from(csvContent, "utf8");
        const fileName = `encuesta_${pollId.slice(-8)}_${new Date().toISOString().slice(0, 10)}.csv`;

        // Adjunta el buffer en lugar de un archivo en disco
        const attachment = new AttachmentBuilder(buffer, { name: fileName });

        await interaction.editReply({
            content: `📊 **Encuesta exportada exitosamente**\n\n**Pregunta:** ${pollData.question}\n**Total de votos:** ${Object.values(pollData.votes).reduce((sum, votes) => sum + votes.length, 0)}\n**Fecha de creación:** ${new Date(pollData.createdAt).toLocaleString()}`,
            files: [attachment],
        });

        // Clean up temporary file
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) console.error("Error deleting temp file:", err);
            });
        }, 30000); // Delete after 30 seconds

        console.log(
            `[INFO] Poll exported: ${pollId} by ${interaction.user.username}`,
        );
    } catch (error) {
        console.error("Error exporting poll:", error);
        await interaction.editReply({
            content: "❌ Hubo un error al generar el archivo de exportación.",
        });
    }
}
