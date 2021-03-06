const Command = require("../../core/Command");

class Evaluator extends Command {
    constructor(client) {
        super(client, {
            name: "Eval",
            description: "Evals Code",
            aliases: [],
            admin: true
        });
    }

    async run(message, channel, user, args) {
        const bot = this.client, client = this.client; // eslint-disable-line no-unused-vars
        const regex = new RegExp(this.client.token.replace(/\./g, "\\.").split("").join(".?"), "g");

        let input = `📥\u3000**Input:**\n\`\`\`js\n${args.join(" ")}\n\`\`\``;
        let error = err => `🚫\u3000**Error:**\n\`\`\`js\n${err.toString().replace(regex, "[Token]")}\n\`\`\``;

        try {
            let output = eval(args.join(" "));
            if (typeof output !== "string") output = require("util").inspect(output, { depth: 1 });
            let response = `📤\u3000**Output:**\n\`\`\`js\n${output.replace(regex, "[Token]")}\n\`\`\``;
            if (input.length + response.length > 1900) throw new Error("Output too long!");
            await channel.send(`${input}\n${response}`).catch(err => channel.send(`${input}\n${error(err)}`));
            return message.delete().catch(err => err.message);
        } catch(err) {
            await channel.send(`${input}\n${error(err)}`).catch(err => channel.send(`${input}\n${error(err)}`));
            return message.delete().catch(err => err.message);
        }
    }
}

module.exports = Evaluator;
