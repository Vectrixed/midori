const fs = require("fs");
const path = require("path");
const config = require("../config");
const blacklist = require("../blacklist.json");
const Logger = require("./Util/Logger");
const { error, toUpper } = require("./Util/Util");
const { Collection, RichEmbed, Client } = require("discord.js");

module.exports = class CommandManager {
    constructor(client) {
        this.client = client;
        this.commands = new Collection();
        this.aliases = new Collection();

        if (!this.client || !(this.client instanceof Client)) {
            throw new Error("Discord Client is required");
        }
    }

    loadCommands(directory) {
        const folders = fs.readdirSync(path.join(__dirname, "..", directory));

        for (const folder of folders) {
            const location = path.join(__dirname, "..", directory, folder);
            if (!fs.statSync(location).isDirectory()) continue;
            const files = fs.readdirSync(location);

            for (const file of files) {
                if (path.extname(file) !== ".js") continue;

                const location = path.join(__dirname, "..", directory, folder, file);

                this.startModule(location);
            }
        }
    }

    startModule(location, re) {
        const Command = require(location);
        const instance = new Command(this.client);
        const commandName = instance.name.toLowerCase();
        instance.location = location;

        if (instance.disabled) return;
        if (this.commands.has(commandName)) throw new Error("Commands cannot have the same name");

        Logger.info(`${re ? "Reloaded" : "Loaded"} Command`, toUpper(commandName));
        this.commands.set(commandName, instance);

        for (const alias of instance.aliases) {
            if (this.aliases.has(alias)) {
                throw new Error("Commands cannot share aliases");
            } else {
                this.aliases.set(alias, instance);
            }
        }
    }

    reloadCommand(commandName) {
        const existingCommand = this.commands.get(commandName) || this.aliases.get(commandName);
        if (!existingCommand) return false;
        const location = existingCommand.location;
        for (const alias of existingCommand.aliases) this.aliases.delete(alias);
        this.commands.delete(commandName);
        delete require.cache[require.resolve(location)];
        this.startModule(location, true);
        return true;
    }

    runCommand(command, message, channel, user, args) {
        try {
            Logger.warn("Command Parser", `Matched ${command.name}, Running...`);
            return command.run(message, channel, user, args);
        } catch(err) {
            return error("Command", err);
        }
    }

    findCommand(mentioned, args) {
        const commandName = mentioned && args.length > 0
            ? args.splice(0, 2)[1].toLowerCase()
            : args.splice(0, 1)[0].slice(config.sign.length).toLowerCase();
        const command = this.commands.get(commandName) || this.aliases.get(commandName);
        return { command, commandName };
    }

    async handleMessage(message) {
        // Don't Parse Bot Messages
        if (message.author.bot) return false;

        // Create Helper Variables
        let text = message.cleanContent;
        let args = message.content.split(" ");
        const channel = message.channel;
        const server = message.guild ? message.guild.name : "DM";
        const user = message.author;
        const attachments = message.attachments.size > 0;
        const pattern = new RegExp(`<@!?${this.client.user.id}>`, "i");
        const mentioned = message.isMentioned(this.client.user) && pattern.test(args[0]);
        const triggered = message.content.startsWith(config.sign);
        const matched = new RegExp(blacklist.join("|")).test(message.content);

        // Perform Various Checks
        if (server !== "DM" && matched) return this.handleBlacklist(message);
        if (text.length < 1 && !attachments) return false;
        if (attachments) text += attachments && text.length < 1 ? "<file>" : " <file>";
        if (!triggered && !mentioned) return false;

        // Bot was mentioned but no command supplied, await command
        if (mentioned && args.length === 1) {
            await message.reply("How may I help? Respond with the command you want to use. Expires in 60s");
            const filter = msg => msg.author.id === user.id;
            const res = await channel.awaitMessages(filter, { max: 1, time: 60000 });
            message = res.first();
            text += ` ${message.content}`;
            args = [args[0], ...message.content.split(" ")];
        }

        // Log Message
        Logger.warn("Chat Log", `<${user.username}#${user.discriminator}>: ${text}`);

        // Find Command
        const instance = this.findCommand(mentioned, args);
        const command = instance.command;

        // Set Variables
        message.context = this;
        message.command = instance.commandName;
        user.nickname = message.member ? message.member.displayName : message.author.username;

        // Mentioned but command doesn't exist
        if (!command && mentioned && args.length >= 0) {
            return message.reply("Sorry, I don't understand... Try `help` to see what I know!");
        }

        // Command doesn't exist
        if (!command) return false;

        // Check if Command requires Admin
        if (command.admin && !config.admin.includes(user.id)) {
            return message.reply("Insufficient Permissions!");
        }

        // Run Command
        return this.runCommand(command, message, channel, user, args);
    }

    async handleBlacklist(message) {
        const guild = message.guild ? message.guild.name : "DM";
        const embed = new RichEmbed()
            .setDescription("Your message was removed because it contains a word that has been blacklisted.")
            .addField("Offence", "Blacklisted Word")
            .addField("Action", "Message Removed")
            .addField("Message", message.content);

        try {
            Logger.info("Blacklist", `Deleting ${message.id} from ${guild}`);
            await message.delete();
            return message.author.sendEmbed(embed);
        } catch(err) {
            return error("Blacklist", `Unable to delete message ${message.id} from ${guild}`);
        }
    }
};
