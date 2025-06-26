# Discord Poll Bot

## Overview

This is a Discord bot built with Node.js and Discord.js v14 that enables users to create interactive polls with "Sí" (Yes), "No", and "Tal vez" (Maybe) voting options. The bot features slash commands, persistent poll storage, and real-time vote tracking through Discord's button interaction system.

## System Architecture

### Architecture Pattern
- **Event-Driven Architecture**: The bot follows Discord.js's event-driven pattern with separate handlers for different Discord events
- **Modular Command System**: Commands are organized as separate modules that are dynamically loaded at startup
- **File-Based Data Persistence**: Poll data is stored in JSON files on the local filesystem

### Core Components
- **Main Bot Client** (`index.js`): Initializes the Discord client, loads commands and events
- **Command System**: Modular slash command handlers in the `/commands` directory
- **Event System**: Discord event handlers in the `/events` directory
- **Poll Manager** (`utils/pollManager.js`): Centralized poll data management and persistence
- **Configuration Management** (`config.js`): Environment variable handling for bot credentials

## Key Components

### Bot Client Setup
- Uses Discord.js v14 with Gateway Intents for Guilds, Guild Messages, and Message Content
- Implements command collection system for dynamic command loading
- Event-driven architecture with separate event handlers

### Command System
- **Slash Commands**: Modern Discord slash command implementation
- **Poll Command** (`/encuesta`): Creates interactive polls with customizable questions and descriptions
- **Command Deployment**: Separate deployment script for registering commands with Discord

### Event Handlers
- **Ready Event**: Bot initialization and status setup
- **Interaction Handler**: Processes both slash commands and button interactions
- **Poll Vote Handling**: Manages vote processing and poll updates

### Data Management
- **PollManager Class**: Handles CRUD operations for poll data
- **JSON File Storage**: Polls stored in `/data/polls.json`
- **In-Memory Caching**: Map-based caching for fast poll access
- **Persistent Storage**: Automatic saving of poll data to filesystem

## Data Flow

### Poll Creation Flow
1. User invokes `/encuesta` slash command
2. Command handler creates poll data structure
3. PollManager stores poll data persistently
4. Discord embed and interaction buttons are created
5. Poll message is sent to Discord channel

### Voting Flow
1. User clicks voting button (Sí/No/Tal vez)
2. Button interaction triggers event handler
3. Vote is processed and validated
4. Poll data is updated in PollManager
5. Poll embed is updated to reflect new vote counts
6. Updated data is persisted to storage

### Data Persistence
- Poll data stored as JSON in `/data/polls.json`
- Automatic directory creation for data storage
- In-memory Map for fast access during runtime
- Periodic saving to prevent data loss

## External Dependencies

### Core Dependencies
- **discord.js v14.21.0**: Primary Discord API wrapper
- **dotenv**: Environment variable management for configuration

### Discord API Integration
- **REST API**: For command deployment and management
- **Gateway Connection**: Real-time event handling and message processing
- **Slash Commands**: Modern Discord command interface
- **Button Interactions**: Interactive poll voting system

### Node.js Built-ins
- **fs/promises**: Asynchronous file system operations
- **path**: Cross-platform file path handling
- **node:fs** and **node:path**: Modern Node.js module imports

## Deployment Strategy

### Development Setup
- **Replit Configuration**: Configured for Node.js 20 runtime
- **Environment Variables**: Bot token, client ID, and guild ID configuration
- **Hot Reloading**: Development-friendly setup with automatic restarts

### Command Deployment
- **Guild-Specific Commands**: Faster deployment for development (when guild ID provided)
- **Global Commands**: Production deployment across all servers (up to 1 hour propagation)
- **Separate Deployment Script**: `deploy-commands.js` for command registration

### File System Structure
```
/
├── commands/          # Slash command modules
├── events/           # Discord event handlers
├── utils/            # Utility classes and helpers
├── data/             # Persistent storage directory
├── config.js         # Configuration management
├── index.js          # Main bot entry point
└── deploy-commands.js # Command deployment script
```

## Recent Changes

### June 26, 2025 - Final UI Polish & Custom Voting Roles
- **Clean Section Headers**: Section names show clean text only (e.g., "Tank" not ":tank:") while preserving emojis in vote results
- **Footer Export Link**: Export functionality as small clickable text in footer for "oficial" role users
- **Custom Voting Roles**: New modal field allows poll creators to specify custom roles for each poll
- **Smart Permission System**: Polls use custom voting roles when specified, otherwise fall back to global permissions
- **Improved Role Validation**: Enhanced permission checking with proper error messages showing allowed roles
- **Modal Enhancement**: Added voting roles configuration field to poll creation interface

### June 26, 2025 - Fixed Custom Emoji Processing
- **Bug Fixes**: Resolved "client is not defined" error that was causing voting failures
- **Emoji Processing**: Fixed custom Discord emoji support to properly display server-specific emojis
- **Function Consistency**: Standardized `createPollEmbed` function signature across all files
- **Error Handling**: Added proper null checks for client parameter to prevent runtime errors

### June 26, 2025 - Customizable Poll Options System
- **Enhanced Poll Creation**: Replaced fixed "Sí/No/Tal vez" options with fully customizable options
- **Modal Interface**: Users now see a form when using `/encuesta` to input question, description, and multiple options
- **Multi-Option Support**: System supports up to 50 custom options per poll (Discord UI limited to 25 options)
- **Dynamic Column Display**: Columns appear only when users vote for specific options
- **Username Display**: Shows actual Discord usernames instead of vote counts
- **Emoji Support**: Full support for standard emojis and custom Discord emojis (e.g., :brewmaster:)
- **Dropdown Menu**: Replaced multiple buttons with single dropdown selection menu
- **Backward Compatibility**: Legacy polls with fixed options continue to work alongside new customizable format

### Technical Implementation
- **Modal System**: Uses Discord's ModalBuilder for intuitive poll creation interface
- **StringSelectMenu**: Single dropdown menu for voting with up to 25 options
- **Dynamic Fields**: Embed fields created dynamically based on received votes only
- **Custom Emoji Support**: Poll options can include Discord server-specific emoji syntax
- **Username Tracking**: Displays voter names in columns instead of numerical counts
- **Flexible Layout**: Responsive column layout accommodating various option names

## Changelog
- June 26, 2025. Initial setup
- June 26, 2025. Added customizable poll options system

## User Preferences

Preferred communication style: Simple, everyday language.