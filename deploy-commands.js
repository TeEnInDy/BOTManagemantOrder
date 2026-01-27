// deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST().setToken(config.token);

(async () => {
    try {
        console.log(`กำลังลงทะเบียนคำสั่ง Slash ทั้งหมด ${commands.length} คำสั่ง...`);
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );
        console.log('✅ ลงทะเบียนคำสั่งสำเร็จ!');
    } catch (error) {
        console.error(error);
    }
})();