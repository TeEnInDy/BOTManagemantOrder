const { Client, Collection, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// ================= CONFIG =================
const PORT = 4001; // Port สำหรับรับ Alert จากเว็บ
const BACKEND_URL = 'http://localhost:4000/api/orders'; // URL Backend หลัก
const CHANNEL_ID = '1466008300909891725'; // 🔴 ห้องที่จะให้แจ้งเตือน Alert
// ==========================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();
const app = express(); // สร้าง Express App ใน index เลย

app.use(cors());
app.use(express.json());

// --- 1. โหลดคำสั่ง Slash Commands ---
const commandsPath = path.join(__dirname, 'src', 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// --- 2. Webhook รับออเดอร์จากหน้าเว็บ (ย้ายมาจาก alert.js) ---
app.post('/notify/new-order', async (req, res) => {
    try {
        const { orderId, totalAmount, items, customerName } = req.body;
        console.log(`🔔 Web Alert: Order #${orderId}`);

        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
            const itemsList = items.map(i => `• ${i.name} (x${i.quantity})`).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`🍽️ มีออเดอร์ใหม่! (บิล #${orderId})`)
                .setDescription(`**ลูกค้า:** ${customerName || 'หน้าร้าน'}`)
                .addFields(
                    { name: '💵 ยอดรวม', value: `\`${Number(totalAmount).toLocaleString()} บาท\``, inline: true },
                    { name: '📦 รายการอาหาร', value: itemsList || '-', inline: false },
                    { name: '🕒 สถานะ', value: '⏳ รอทำอาหาร (Pending)', inline: true }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`complete_${orderId}`).setLabel('✅ ทำเสร็จแล้ว').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`cancel_${orderId}`).setLabel('❌ ยกเลิกบิล').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [embed], components: [row] });
            return res.json({ success: true });
        }
        return res.status(404).send('Channel not found');
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send({ error: error.message });
    }
});

// --- 3. ตัวจัดการปุ่มกด (Global Button Handler) ---
client.on(Events.InteractionCreate, async interaction => {
    // 3.1 จัดการ Slash Command (/order)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } 
        catch (error) { console.error(error); }
        return;
    }

    // 3.2 จัดการปุ่มกด (Complete / Cancel)
    if (interaction.isButton()) {
        // เช็คก่อนว่าเป็นปุ่มของเราไหม (complete_XXX หรือ cancel_XXX)
        if (!interaction.customId.startsWith('complete_') && !interaction.customId.startsWith('cancel_')) return;

        const [action, orderId] = interaction.customId.split('_');
        
        // ตอบกลับ Discord ทันทีว่า "กำลังคิด..." เพื่อป้องกัน Error "Interaction Failed"
        await interaction.deferUpdate(); 

        try {
            if (action === 'complete') {
                // ยิงไป Backend
                await axios.patch(`${BACKEND_URL}/${orderId}/status`, { status: 'Completed' });

                // อัปเดต Embed
                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = new EmbedBuilder(oldEmbed.data)
                    .setColor(0x2ecc71) // เขียว
                    .spliceFields(2, 1, { name: '✅ สถานะ', value: 'เสร็จสิ้น (Completed)', inline: true });

                // ปิดปุ่ม
                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(btn => btn.setDisabled(true));

                await interaction.editReply({ content: `✅ **บิล #${orderId}** จบงานแล้ว!`, embeds: [newEmbed], components: [disabledRow] });
            
            } else if (action === 'cancel') {
                await axios.patch(`${BACKEND_URL}/${orderId}/status`, { status: 'Cancelled' });

                const oldEmbed = interaction.message.embeds[0];
                const newEmbed = new EmbedBuilder(oldEmbed.data)
                    .setColor(0xe74c3c) // แดง
                    .spliceFields(2, 1, { name: '❌ สถานะ', value: 'ยกเลิก (Cancelled)', inline: true });

                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(btn => btn.setDisabled(true));

                await interaction.editReply({ content: `❌ **บิล #${orderId}** ถูกยกเลิกแล้ว`, embeds: [newEmbed], components: [disabledRow] });
            }
        } catch (error) {
            console.error('Button API Error:', error.message);
            await interaction.followUp({ content: '❌ เชื่อมต่อ Backend ไม่ได้ หรือ Order นี้ไม่มีอยู่จริง', ephemeral: true });
        }
    }
});

// --- 4. Start Server ---
client.once(Events.ClientReady, c => {
    console.log(`🚀 Bot Ready! Logged in as ${c.user.tag}`);
    app.listen(PORT, () => {
        console.log(`📡 Alert Server running on port ${PORT}`);
    });
});

client.login(process.env.DISCORD_TOKEN);