const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

/* ===== Product Config ===== */
const PRODUCTS = {
    SHRIMP_99:  { label: 'กุ้งกอง 99฿',  name: 'กุ้งกอง 99฿',  price: 99,  freeRice: false },
    SHRIMP_149: { label: 'กุ้งกอง 149฿', name: 'กุ้งกอง 149฿', price: 149, freeRice: false },
    SHRIMP_199: { label: 'กุ้งกอง 199฿', name: 'กุ้งกอง 199฿', price: 199, freeRice: false },
    SHRIMP_249: { label: 'กุ้งกอง 249฿', name: 'กุ้งกอง 249฿', price: 249, freeRice: false },
    SHRIMP_299: { label: 'กุ้งกอง 299฿', name: 'กุ้งกอง 299฿', price: 299, freeRice: true },
    SHRIMP_349: { label: 'กุ้งกอง 349฿', name: 'กุ้งกอง 349฿', price: 349, freeRice: true },
    EXTRA_RICE: { label: 'ข้าวญี่ปุ่น',   name: 'ข้าวญี่ปุ่น (+20฿)', price: 20, freeRice: false },
    SEAWEED:    { label: 'สาหร่าย',     name: 'สาหร่าย (+20฿)',    price: 20, freeRice: false },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('order')
        .setDescription('ระบบ POS แบบตะกร้าสินค้า (เพิ่ม/ลด จำนวนได้)'),

    async execute(interaction) {
        try {
            const userName = interaction.user.globalName || interaction.user.username;

            // 🛒 State Variables
            let cart = {}; 
            let isPaid = false; 
            let isRemoveMode = false; // ✨ ตัวแปรใหม่: เช็คว่าเป็นโหมดลบหรือไม่

            /* ===== Function สร้างหน้าจอ UI ===== */
            const renderInterface = () => {
                // 1. คำนวณยอดรวม
                let totalPrice = 0;
                let itemsList = [];
                let totalItems = 0;

                for (const [key, qty] of Object.entries(cart)) {
                    const p = PRODUCTS[key];
                    if (p) {
                        const sumPrice = p.price * qty;
                        totalPrice += sumPrice;
                        totalItems += qty;
                        itemsList.push(`> \`x${qty}\` **${p.name}** (${sumPrice.toLocaleString()} บ.)`);
                    }
                }

                // 2. Embed
                const embed = new EmbedBuilder()
                    .setColor(isPaid ? 0x2ecc71 : (isRemoveMode ? 0xff9f43 : 0x3498db)) // เขียว=จ่าย, ส้ม=โหมดลบ, ฟ้า=ปกติ
                    .setTitle(`🛒 ระบบจัดการออเดอร์: คุณ ${userName}`)
                    .setDescription(itemsList.length > 0 ? itemsList.join('\n') : '*... ตะกร้าว่างเปล่า ...*')
                    .addFields(
                        { name: '💰 ยอดสุทธิ', value: `\`${totalPrice.toLocaleString()} บาท\``, inline: true },
                        { name: '💳 สถานะ', value: isPaid ? '✅ ชำระแล้ว' : '⏳ ยังไม่ชำระ', inline: true },
                        { name: '⚙️ โหมดทำงาน', value: isRemoveMode ? '⛔ กำลังลบสินค้า' : '➕ กำลังเพิ่มสินค้า', inline: true }
                    );

                // 3. Components
                // ถ้าอยู่ในโหมดลบ จะโชว์เฉพาะของที่มีในตะกร้า เพื่อให้ User ไม่งง
                const availableKeys = isRemoveMode ? Object.keys(cart) : Object.keys(PRODUCTS);
                
                // กรณีโหมดลบ แต่ตะกร้าว่าง ให้กลับไปโหมดเพิ่มอัตโนมัติ (ป้องกัน Error)
                if (isRemoveMode && availableKeys.length === 0) {
                    isRemoveMode = false; // Reset mode
                }

                const productOptions = availableKeys.map(key => {
                    const p = PRODUCTS[key];
                    return {
                        label: isRemoveMode ? `ลบ ${p.label} ออก (-1)` : `${p.label} (+1)`,
                        value: key,
                        description: isRemoveMode ? `มีในตะกร้า: ${cart[key]} ชิ้น` : `ราคา ${p.price} บาท`,
                        emoji: isRemoveMode ? '⛔' : '📦'
                    };
                });

                // สร้าง Menu (ถ้าไม่มีของในตะกร้าตอนโหมดลบ จะไม่สร้าง Menu)
                const components = [];
                
                if (productOptions.length > 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            // ✨ เปลี่ยน ID ตามโหมด เพื่อให้แยก Logic ได้ง่าย
                            .setCustomId(isRemoveMode ? 'remove_product_menu' : 'add_product_menu') 
                            .setPlaceholder(isRemoveMode ? '⛔ เลือกสินค้าเพื่อลดจำนวน' : '➕ เลือกสินค้าเพื่อเพิ่มลงตะกร้า')
                            .addOptions(productOptions)
                    ));
                }

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_toggle_mode')
                        .setLabel(isRemoveMode ? 'กลับไปโหมดเพิ่ม' : 'เปลี่ยนเป็นโหมดลด')
                        .setStyle(isRemoveMode ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId('btn_clear')
                        .setLabel('ล้าง')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️'),
                    new ButtonBuilder()
                        .setCustomId('btn_toggle_payment')
                        .setLabel(isPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย')
                        .setStyle(isPaid ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('💳'),
                    new ButtonBuilder()
                        .setCustomId('btn_checkout')
                        .setLabel(`ยืนยัน (${totalItems})`)
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(totalItems === 0)
                        .setEmoji('✅')
                ));

                return { embeds: [embed], components };
            };

            const response = await interaction.reply({ ...renderInterface(), withResponse: true });

            /* ===== Collector ===== */
            const collector = response.resource.message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000,
            });

            collector.on('collect', async (i) => {
                // 🟢 เพิ่มสินค้า
                if (i.customId === 'add_product_menu') {
                    const key = i.values[0];
                    if (!cart[key]) cart[key] = 0;
                    cart[key] += 1;
                    await i.update(renderInterface());
                }

                // 🔴 ลดสินค้า
                if (i.customId === 'remove_product_menu') {
                    const key = i.values[0];
                    if (cart[key]) {
                        cart[key] -= 1;
                        if (cart[key] <= 0) delete cart[key]; // ถ้าเหลือ 0 ให้ลบ key ออก
                    }
                    // เช็คว่าตะกร้าว่างไหม ถ้าว่างให้เด้งกลับโหมดเพิ่ม
                    if (Object.keys(cart).length === 0) isRemoveMode = false;
                    await i.update(renderInterface());
                }

                // 🔄 สลับโหมด เพิ่ม/ลด
                if (i.customId === 'btn_toggle_mode') {
                    // ถ้าตะกร้าว่าง ห้ามเข้าโหมดลบ
                    if (!isRemoveMode && Object.keys(cart).length === 0) {
                        return i.reply({ content: '⚠️ ตะกร้าว่างเปล่า ไม่สามารถเข้าโหมดลดสินค้าได้ครับ', ephemeral: true });
                    }
                    isRemoveMode = !isRemoveMode;
                    await i.update(renderInterface());
                }

                // 🗑️ ล้างตะกร้า
                if (i.customId === 'btn_clear') {
                    cart = {};
                    isRemoveMode = false; // Reset mode
                    await i.update(renderInterface());
                }

                // 💳 สถานะจ่ายเงิน
                if (i.customId === 'btn_toggle_payment') {
                    isPaid = !isPaid;
                    await i.update(renderInterface());
                }

                // ✅ ยืนยัน (Checkout) - Logic เดิม
                if (i.customId === 'btn_checkout') {
                    const modal = new ModalBuilder().setCustomId('checkout_modal').setTitle('📝 ข้อมูลลูกค้า');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('customer_name').setLabel('ชื่อลูกค้า / เลขโต๊ะ').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('order_note').setLabel('หมายเหตุ').setStyle(TextInputStyle.Paragraph).setRequired(false))
                    );
                    
                    await i.showModal(modal);

                    try {
                        const submit = await i.awaitModalSubmit({
                            filter: (m) => m.customId === 'checkout_modal',
                            time: 60000,
                        });

                        await submit.deferReply();

                        const customerName = submit.fields.getTextInputValue('customer_name');
                        const note = submit.fields.getTextInputValue('order_note') || '-';

                        let itemsDB = [];
                        let totalPrice = 0;
                        let hasFreeRice = false;

                        for (const [key, qty] of Object.entries(cart)) {
                            const p = PRODUCTS[key];
                            const lineTotal = p.price * qty;
                            totalPrice += lineTotal;
                            if (p.freeRice) hasFreeRice = true;
                            itemsDB.push(`${p.name} (x${qty})`);
                        }
                        if (hasFreeRice) itemsDB.push('ข้าวญี่ปุ่น (แถมฟรี 🎁)');

                        const statusText = isPaid ? '✅ ชำระแล้ว' : '⏳ ยังไม่ชำระ';

                        await pool.execute(
                            `INSERT INTO orders (id, seller_name, customer_name, products, total_price, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                            [uuidv4(), userName, customerName, itemsDB.join(', '), totalPrice, statusText, note]
                        );

                        const summary = `
**✅ บันทึกออเดอร์เรียบร้อยแล้ว**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **ลูกค้า:** ${customerName}
🧾 **รายการ:**
${itemsDB.map(item => `> • ${item}`).join('\n')}
────────────────────────
💰 **ยอดสุทธิ:** \`${totalPrice.toLocaleString()} บาท\`
────────────────────────
💳 **สถานะ:** ${statusText}
📌 **หมายเหตุ:** ${note}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                        await submit.editReply({ content: summary, embeds: [], components: [] });
                        collector.stop();

                    } catch (e) { console.log('Timeout/Error', e); }
                }
            });

        } catch (err) {
            console.error('❌ Execute Error:', err);
            if (!interaction.replied) await interaction.reply({ content: '❌ Error', ephemeral: true });
        }
    },
};