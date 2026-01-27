const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('greet')
        .setDescription('ทักทายผู้ใช้งาน'),
    async execute(interaction) {
        await interaction.reply(`สวัสดีครับคุณ ${interaction.user.username}! ยินดีต้อนรับสู่ระบบ Management Order ครับผม`);
    },
};