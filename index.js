// index.js
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');

// ตั้งค่า Client พร้อม Intents ที่จำเป็น
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ] 
});

client.commands = new Collection();

// --- 1. ส่วนโหลดคำสั่ง (Dynamic Command Loading) ---
const commandsPath = path.join(__dirname, 'src', 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // ตรวจสอบว่าไฟล์คำสั่งมีโครงสร้างที่ถูกต้องหรือไม่
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ โหลดคำสั่ง: ${command.data.name}`);
        } else {
            console.log(`[WARNING] คำสั่งที่ ${filePath} ขาดคุณสมบัติ "data" หรือ "execute"`);
        }
    }
} else {
    console.error(`❌ ไม่พบโฟลเดอร์คำสั่งที่: ${commandsPath}`);
}

// --- 2. ส่วนจัดการการตอบโต้ (Interaction Handling) ---
client.on(Events.InteractionCreate, async interaction => {
    // ตรวจสอบว่าเป็น Slash Command หรือไม่
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`ไม่พบคำสั่ง ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ เกิดข้อผิดพลาดที่คำสั่ง ${interaction.commandName}:`, error);
        
        // ตรวจสอบว่าบอทเคยตอบกลับไปหรือยัง เพื่อเลือกใช้ reply หรือ followUp
        const errorMessage = { content: '❌ เกิดข้อผิดพลาดในการรันคำสั่งนี้!', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// --- 3. ส่วนเริ่มต้นการทำงาน (Ready Event) ---
client.once(Events.ClientReady, (c) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 บอทออนไลน์แล้ว! ชื่อ: ${c.user.tag}`);
    console.log(`📅 วันที่: ${new Date().toLocaleString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// ล็อกอินบอทด้วย Token จาก config.json
client.login(config.token);