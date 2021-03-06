const { RichEmbed } = require("discord.js");
const request = require("request-promise");
const Command = require("../../core/Command");

class Compute extends Command {
    constructor(client) {
        super(client, {
            name: "Compute",
            description: "Computes Computations",
            aliases: ["c", "comp", "convert"]
        });
    }

    async run(message, channel, user, args) {
        if (args.length < 1) {
            return message.reply("Please provide a query");
        }

        const response = await request({
            method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Authorization": this.keychain.sherlock
            },
            uri: "https://api.kurisubrooks.com/api/compute/convert",
            body: { query: args.join(" ") },
            json: true
        }).catch(err => {
            this.log(err, "fatal", true);
            return this.error(err, channel);
        });

        if (!response.ok) return this.error(response.error, channel);

        const embed = new RichEmbed()
            .setColor(this.config.colours.default)
            .setAuthor(user.nickname, user.avatarURL)
            .addField("Query", response.query)
            .addField("Result", response.output.display);

        await channel.sendEmbed(embed);
        return message.delete().catch(err => err.message);
    }
}

module.exports = Compute;
