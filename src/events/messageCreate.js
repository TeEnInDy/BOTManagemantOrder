// # เมื่อมีข้อความส่งมา
module.exports = {
    name: "messageCreate",
    execute(message, client) {
      if (!message.content.startsWith("!") || message.author.bot) return;
  
      const args = message.content.slice(1).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
  
      if (client.commands.has(commandName)) {
        client.commands.get(commandName).execute(message, args);
      }
    },
  };
  