const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const axios = require('axios');

// 🔗 URL Backend
const API_URL = 'http://localhost:4000/api/orders';

/* ===== ⚠️ แก้ไข ID ให้ตรงกับ Database ของคุณ ⚠️ ===== */
const PRODUCTS = {
    EXTRA_RICE: { id: 1, label: 'ข้าวญี่ปุ่น', name: 'ข้าวญี่ปุ่น', price: 20 },
    SEAWEED:    { id: 2, label: 'สาหร่าย', name: 'สาหร่าย', price: 20 },
    SHRIMP_99:  { id: 3, label: 'กุ้งดอง 99฿', name: 'กุ้งดอง 99฿ (10 ตัว)', price: 99 },
    SHRIMP_149: { id: 4, label: 'กุ้งดอง 149฿', name: 'กุ้งดอง 149฿ (15 ตัว)', price: 149 },
    SHRIMP_199: { id: 5, label: 'กุ้งดอง 199฿', name: 'กุ้งดอง 199฿ (20 ตัว)', price: 199 },
    SHRIMP_249: { id: 6, label: 'กุ้งดอง 249฿', name: 'กุ้งดอง 249฿ (25 ตัว)', price: 249 },
    SHRIMP_299: { id: 7, label: 'กุ้งดอง 299฿', name: 'กุ้งดอง 299฿ (Set 30 ตัว)', price: 299 },
    SHRIMP_349: { id: 8, label: 'กุ้งดอง 349฿', name: 'กุ้งดอง 349฿ (Set 35 ตัว)', price: 349 }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('order')
        .setDescription('ระบบ POS แบบตะกร้าสินค้า'),

    async execute(interaction) {
        try {
            const userName = interaction.user.globalName || interaction.user.username;
            let cart = {};
            let isPaid = false;
            let isRemoveMode = false;

            /* UI Render Function */
            const renderInterface = () => {
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

                const embed = new EmbedBuilder()
                    .setColor(isPaid ? 0x2ecc71 : (isRemoveMode ? 0xff9f43 : 0x3498db))
                    .setTitle(`🛒 ระบบจัดการออเดอร์: คุณ ${userName}`)
                    .setDescription(itemsList.length > 0 ? itemsList.join('\n') : '*... ตะกร้าว่างเปล่า ...*')
                    .addFields(
                        { name: '💰 ยอดสุทธิ', value: `\`${totalPrice.toLocaleString()} บาท\``, inline: true },
                        { name: '💳 สถานะ', value: isPaid ? '✅ ชำระแล้ว' : '⏳ ยังไม่ชำระ', inline: true },
                        { name: '⚙️ โหมด', value: isRemoveMode ? '⛔ ลบสินค้า' : '➕ เพิ่มสินค้า', inline: true }
                    );

                const availableKeys = isRemoveMode ? Object.keys(cart) : Object.keys(PRODUCTS);
                if (isRemoveMode && availableKeys.length === 0) isRemoveMode = false;

                const productOptions = availableKeys.map(key => ({
                    label: isRemoveMode ? `ลบ ${PRODUCTS[key].label} (-1)` : `${PRODUCTS[key].label} (+1)`,
                    value: key,
                    description: `ราคา ${PRODUCTS[key].price} บาท`,
                    emoji: isRemoveMode ? '⛔' : '📦'
                }));

                const components = [];
                if (productOptions.length > 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(isRemoveMode ? 'remove_menu' : 'add_menu')
                            .setPlaceholder(isRemoveMode ? 'เลือกสินค้าเพื่อลบ' : 'เลือกสินค้าเพื่อเพิ่ม')
                            .addOptions(productOptions)
                    ));
                }

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_mode').setLabel(isRemoveMode ? 'กลับโหมดเพิ่ม' : 'เปลี่ยนโหมดลบ').setStyle(isRemoveMode ? ButtonStyle.Secondary : ButtonStyle.Primary).setEmoji('🔄'),
                    new ButtonBuilder().setCustomId('btn_clear').setLabel('ล้าง').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                    new ButtonBuilder().setCustomId('btn_pay').setLabel(isPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย').setStyle(isPaid ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('💳'),
                    new ButtonBuilder().setCustomId('btn_checkout').setLabel(`ยืนยัน (${totalItems})`).setStyle(ButtonStyle.Success).setDisabled(totalItems === 0).setEmoji('✅')
                ));

                return { embeds: [embed], components };
            };

            const response = await interaction.reply({ ...renderInterface(), withResponse: true });
            const collector = response.resource.message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000
            });

            collector.on('collect', async (i) => {
                if (['add_menu', 'remove_menu', 'btn_mode', 'btn_clear', 'btn_pay'].includes(i.customId)) {
                    if (i.customId === 'add_menu') {
                        const key = i.values[0];
                        if (!cart[key]) cart[key] = 0;
                        cart[key] += 1;
                    } else if (i.customId === 'remove_menu') {
                        const key = i.values[0];
                        if (cart[key]) {
                            cart[key] -= 1;
                            if (cart[key] <= 0) delete cart[key];
                        }
                        if (Object.keys(cart).length === 0) isRemoveMode = false;
                    } else if (i.customId === 'btn_mode') {
                        isRemoveMode = !isRemoveMode;
                    } else if (i.customId === 'btn_clear') {
                        cart = {}; isRemoveMode = false; isPaid = false;
                    } else if (i.customId === 'btn_pay') {
                        isPaid = !isPaid;
                    }
                    await i.update(renderInterface());
                }

                // 🚀 ส่วน Checkout (แก้ไขให้เป็น Text Summary และไม่มีปุ่ม)
                else if (i.customId === 'btn_checkout') {
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

                        // 1. รับเรื่องและเตรียมตอบกลับ
                        await submit.deferReply(); 
                        
                        // 2. ลบเมนูเลือกสินค้าเดิมทิ้ง (ให้เหลือแค่ข้อความสรุปใหม่ที่จะส่งไป)
                        try { await interaction.deleteReply(); } catch {}

                        const customerName = submit.fields.getTextInputValue('customer_name');
                        const note = submit.fields.getTextInputValue('order_note') || '-';

                        let apiItems = [];
                        let totalPrice = 0;
                        for (const [key, qty] of Object.entries(cart)) {
                            const p = PRODUCTS[key];
                            if (p) {
                                apiItems.push({ id: p.id, name: p.name, quantity: qty, price: p.price });
                                totalPrice += (p.price * qty);
                            }
                        }

                        // ยิง API Backend
                        const apiResponse = await axios.post(API_URL, {
                            customerName,
                            totalAmount: totalPrice,
                            paymentMethod: isPaid ? 'Cash' : 'Pending',
                            items: apiItems,
                            discordUserId: interaction.user.id,
                            discordChannelId: interaction.channelId
                        });

                        const orderId = apiResponse.data.id;

                        if (isPaid) {
                            await axios.patch(`${API_URL}/${orderId}/status`, { status: 'Completed' });
                        }

                        // 🔥 3. สร้างข้อความสรุป (Text Summary)
                        const summary = `
**✅ ส่งออเดอร์เข้าครัวเรียบร้อย! (Order #${orderId})**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **ลูกค้า:** ${customerName}
🧾 **รายการ:**
${apiItems.map(item => `> • ${item.name} (x${item.quantity})`).join('\n')}
────────────────────────
💰 **ยอดสุทธิ:** \`${totalPrice.toLocaleString()} บาท\`
────────────────────────
💳 **สถานะการจ่าย:** ${isPaid ? '✅ จ่ายแล้ว' : '⏳ รอเก็บเงิน'}
📌 **หมายเหตุ:** ${note}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                        // 🔥 4. ส่งข้อความสรุปกลับไป (โดยไม่มีปุ่มกด components: [])
                        await submit.editReply({ content: summary, embeds: [], components: [] });
                        
                        collector.stop();

                    } catch (e) {
                        console.error('Error:', e.response ? e.response.data : e.message);
                        
                        // ถ้า Error ก็แจ้งกลับไป
                        await submit.editReply({ 
                            content: `❌ **เกิดข้อผิดพลาด!**\nBackend แจ้งว่า: \`${e.response?.data?.error || e.message}\``, 
                            embeds: [],
                            components: []
                        });
                    }
                }
            });

        } catch (err) {
            console.error('Command Error:', err);
        }
    },
};