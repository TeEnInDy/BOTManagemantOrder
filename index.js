const { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    Events, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client'); // เพิ่ม Prisma เข้ามา
require('dotenv').config();

// --- 1. ตั้งค่า Client, Express และ Prisma ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();
const app = express();
const prisma = new PrismaClient(); // สร้างตัวเชื่อม Database
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// --- 2. ส่วนโหลดคำสั่ง (เหมือนเดิม) ---
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

// --- 3. Webhook Endpoint (รับออเดอร์ + เพิ่มปุ่ม) ---
app.post('/notify/new-order', async (req, res) => {
    try {
        const { orderId, totalAmount, items } = req.body;
        console.log(`🔔 มีออเดอร์ใหม่เข้ามา! Order #${orderId}`);

        const channelId = process.env.YOUR_DISCORD_CHANNEL_ID;
        const channel = client.channels.cache.get(channelId);
        
        if (channel) {
            // A. สร้าง Embed (การ์ด)
            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // สีฟ้า (สถานะ Pending)
                .setTitle(`🍽️ มีออเดอร์ใหม่! (บิล #${orderId})`)
                .setDescription(`ยอดรวม: **${totalAmount} บาท**`)
                .addFields(
                    { name: 'รายการอาหาร', value: items.map(i => `• ${i.name} (x${i.quantity})`).join('\n') || 'ไม่ระบุ' },
                    { name: 'สถานะ', value: '🕒 รอทำอาหาร (Pending)', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Pickled Shrimp POS System' });

            // B. สร้างปุ่ม (Button)
            const completeButton = new ButtonBuilder()
                .setCustomId(`complete_${orderId}`) // ฝัง ID ออเดอร์ไว้ในปุ่ม
                .setLabel('✅ ทำเสร็จแล้ว (Complete)')
                .setStyle(ButtonStyle.Success); // ปุ่มสีเขียว

            const row = new ActionRowBuilder().addComponents(completeButton);

            // ส่งข้อความพร้อมปุ่ม
            await channel.send({ embeds: [embed], components: [row] });
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: "Channel not found" });
        }
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- 4. ส่วนจัดการการกดปุ่ม (Button Interaction) ---
client.on(Events.InteractionCreate, async interaction => {
    // ถ้าไม่ใช่การกดปุ่ม ให้ข้ามไป
    if (!interaction.isButton()) return;

    // เช็คว่าเป็นปุ่ม "ทำเสร็จแล้ว" หรือไม่
    if (interaction.customId.startsWith('complete_')) {
        const orderId = interaction.customId.split('_')[1]; // ดึงเลข ID จาก customId

        try {
            // 1. อัปเดตสถานะใน Database เป็น Completed
            // (ต้องใช้ Prisma Update ข้อมูลจริง)
            await prisma.order.update({
                where: { id: parseInt(orderId) },
                data: { status: 'Completed' }
            });

            // 2. แก้ไขข้อความใน Discord (เปลี่ยนสี + ลบปุ่ม)
            const oldEmbed = interaction.message.embeds[0];
            
            const newEmbed = new EmbedBuilder(oldEmbed.data)
                .setColor(0x00FF00) // เปลี่ยนเป็นสีเขียว
                .setTitle(`✅ ออเดอร์เสร็จสิ้น! (บิล #${orderId})`)
                .setFields(
                    // คงรายการอาหารไว้ แต่แก้สถานะ
                    { name: oldEmbed.fields[0].name, value: oldEmbed.fields[0].value },
                    { name: 'สถานะ', value: '🍳 ปรุงเสร็จแล้ว (Completed)', inline: true },
                    { name: 'ผู้ดำเนินการ', value: `โดย ${interaction.user.username}`, inline: true }
                );

            // อัปเดตข้อความเดิม (ลบปุ่มออกด้วย components: [])
            await interaction.update({ embeds: [newEmbed], components: [] });
            console.log(`✅ ออเดอร์ #${orderId} ถูกกดจบงานแล้ว`);

        } catch (error) {
            console.error("Error updating order:", error);
            await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูล!', ephemeral: true });
        }
    }
});

// --- ส่วน Slash Command เดิม ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
    }
});

// --- 5. เริ่มต้นการทำงาน ---
client.once(Events.ClientReady, (c) => {
    console.log(`🚀 บอทออนไลน์แล้ว! ชื่อ: ${c.user.tag}`);
    app.listen(PORT, () => {
        console.log(`👂 Webhook Listener เปิดที่ Port: ${PORT}`);
    });
});

client.login(process.env.DISCORD_TOKEN);