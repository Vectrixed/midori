const { RichEmbed } = require("discord.js");
const request = require("request-promise");
const markdown = require("to-markdown");
const Command = require("../../core/Command");

class Dictionary extends Command {
    constructor(client) {
        super(client, {
            name: "Dictionary",
            description: "Get the Definition of a Word",
            aliases: ["define", "dict", "d"]
        });
    }

    async run(message, channel, user, args) {
        if (args.length < 1) {
            return message.reply("Please provide a query");
        }

        let description = "";
        const response = await request({
            headers: { "User-Agent": "Mozilla/5.0" },
            uri: "https://glosbe.com/gapi/translate",
            json: true,
            qs: {
                from: "en",
                dest: "en",
                format: "json",
                phrase: args.join(" ")
            }
        }).catch(err => {
            this.log(err, "fatal", true);
            return this.error(err, channel);
        });

        const embed = new RichEmbed()
            .setColor(this.config.colours.default)
            .setAuthor(user.nickname, user.avatarURL)
            .setTitle(`Define: '${args.join(" ")}'`);

        if (response.result !== "ok") {
            return this.error("API Error", channel);
        }

        if (!response.tuc) {
            return this.error("No Results Returned", channel);
        }

        const definitions = response.tuc.find(obj => obj.meanings);

        if (definitions.meanings.length === 0) {
            return this.error("No Results Returned", channel);
        }

        for (let index = 0; index < 5; index++) {
            description += `**${index + 1}.**\u3000${markdown(definitions.meanings[index].text)}\n`;
        }

        embed.setDescription(description);
        await channel.sendEmbed(embed);
        return message.delete().catch(err => err.message);
    }
}

module.exports = Dictionary;
