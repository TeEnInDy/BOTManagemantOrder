const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('บอทตอบรับคำทักทาย'),
    async execute(interaction) {
        await interaction.reply('ยินดีที่ได้รู้จักครับ ผมคือบอทช่วยจัดการออเดอร์ มีอะไรให้ช่วยไหมครับ?');
    },
};