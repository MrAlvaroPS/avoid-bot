const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const POLLS_FILE = path.join(DATA_DIR, 'polls.json');

class PollManager {
    constructor() {
        this.polls = new Map();
        this.init();
    }

    async init() {
        try {
            // Ensure data directory exists
            await fs.mkdir(DATA_DIR, { recursive: true });
            
            // Load existing polls
            await this.loadAllPolls();
            
            console.log(`[INFO] PollManager initialized with ${this.polls.size} polls`);
        } catch (error) {
            console.error('Error initializing PollManager:', error);
        }
    }

    async loadAllPolls() {
        try {
            const data = await fs.readFile(POLLS_FILE, 'utf8');
            const pollsArray = JSON.parse(data);
            
            // Convert array to Map for faster access
            this.polls.clear();
            pollsArray.forEach(poll => {
                this.polls.set(poll.id, poll);
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet, start with empty polls
                this.polls.clear();
                await this.saveAllPolls();
            } else {
                console.error('Error loading polls:', error);
            }
        }
    }

    async saveAllPolls() {
        try {
            const pollsArray = Array.from(this.polls.values());
            await fs.writeFile(POLLS_FILE, JSON.stringify(pollsArray, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving polls:', error);
            throw error;
        }
    }

    async savePoll(pollData) {
        try {
            // Add/update poll in memory
            this.polls.set(pollData.id, pollData);
            
            // Save to file
            await this.saveAllPolls();
            
            return pollData;
        } catch (error) {
            console.error('Error saving poll:', error);
            throw error;
        }
    }

    async loadPoll(pollId) {
        try {
            return this.polls.get(pollId) || null;
        } catch (error) {
            console.error('Error loading poll:', error);
            return null;
        }
    }

    async deletePoll(pollId) {
        try {
            const deleted = this.polls.delete(pollId);
            
            if (deleted) {
                await this.saveAllPolls();
            }
            
            return deleted;
        } catch (error) {
            console.error('Error deleting poll:', error);
            throw error;
        }
    }

    async getPollsByAuthor(authorId) {
        try {
            const authorPolls = [];
            
            for (const poll of this.polls.values()) {
                if (poll.author.id === authorId) {
                    authorPolls.push(poll);
                }
            }
            
            return authorPolls;
        } catch (error) {
            console.error('Error getting polls by author:', error);
            return [];
        }
    }

    async getPollsByChannel(channelId) {
        try {
            const channelPolls = [];
            
            for (const poll of this.polls.values()) {
                if (poll.channelId === channelId) {
                    channelPolls.push(poll);
                }
            }
            
            return channelPolls;
        } catch (error) {
            console.error('Error getting polls by channel:', error);
            return [];
        }
    }

    async getAllPolls() {
        try {
            return Array.from(this.polls.values());
        } catch (error) {
            console.error('Error getting all polls:', error);
            return [];
        }
    }

    async cleanupOldPolls(maxAgeHours = 24 * 7) { // Default: 7 days
        try {
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            let deletedCount = 0;
            
            for (const [pollId, poll] of this.polls.entries()) {
                const pollDate = new Date(poll.createdAt);
                
                if (pollDate < cutoffTime) {
                    this.polls.delete(pollId);
                    deletedCount++;
                }
            }
            
            if (deletedCount > 0) {
                await this.saveAllPolls();
                console.log(`[INFO] Cleaned up ${deletedCount} old polls`);
            }
            
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up old polls:', error);
            return 0;
        }
    }
}

// Create singleton instance
const pollManager = new PollManager();

module.exports = pollManager;
