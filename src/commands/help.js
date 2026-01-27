const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('ดูรายการคำสั่งทั้งหมด'),
    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 รายการคำสั่งทั้งหมด')
            .addFields(
                { name: 'ทั่วไป', value: '`/greet`, `/hello`, `/help`' },
                { name: 'จัดการออเดอร์/งาน', value: '`/order`' },
                { name: 'เพลง (Music)', value: '`/play`, `/stop`, `/skip`, `/queue`' }
            )
            .setFooter({ text: 'Management Order System' });

        await interaction.reply({ embeds: [helpEmbed] });
    },
};