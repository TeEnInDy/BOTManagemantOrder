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
const axios = require('axios'); // ✅ ใช้ Axios ยิง API แทน

/* ===== Product Config ===== 
   ⚠️ สำคัญ: คุณต้องแก้เลข 'id' ด้านล่างให้ตรงกับ ID ใน Database จริงๆ (ดูใน phpMyAdmin)
   ถ้าใส่ ID ผิด ระบบจะ Error ครับ
*/
const PRODUCTS = {
    // 🍚 ของทานเล่น
    EXTRA_RICE: {
        id: 9,   // ✅ ID จริงจาก Database
        label: 'ข้าวญี่ปุ่น',
        name: 'ข้าวญี่ปุ่น',
        price: 20,
        freeRice: false
    },
    SEAWEED: {
        id: 10,  // ✅ ID จริงจาก Database
        label: 'สาหร่าย',
        name: 'สาหร่าย',
        price: 20,
        freeRice: false
    },

    // 🦐 เมนูกุ้งดอง (Main)
    SHRIMP_99: {
        id: 11,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 99฿ (10 ตัว)',
        name: 'กุ้งดอง 99฿ (10 ตัว)',
        price: 99,
        freeRice: false
    },
    SHRIMP_149: {
        id: 12,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 149฿ (15 ตัว)',
        name: 'กุ้งดอง 149฿ (15 ตัว)',
        price: 149,
        freeRice: false
    },
    SHRIMP_199: {
        id: 13,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 199฿ (20 ตัว)',
        name: 'กุ้งดอง 199฿ (20 ตัว)',
        price: 199,
        freeRice: false
    },
    SHRIMP_249: {
        id: 14,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 249฿ (25 ตัว)',
        name: 'กุ้งดอง 249฿ (25 ตัว)',
        price: 249,
        freeRice: false
    },
    SHRIMP_299: {
        id: 15,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 299฿ (Set 30 ตัว)',
        name: 'กุ้งดอง 299฿ (Set 30 ตัว)',
        price: 299,
        freeRice: true
    },
    SHRIMP_349: {
        id: 16,  // ✅ ID จริงจาก Database
        label: 'กุ้งดอง 349฿ (Set 35 ตัว)',
        name: 'กุ้งดอง 349฿ (Set 35 ตัว)',
        price: 349,
        freeRice: true
    }
};
module.exports = {
    data: new SlashCommandBuilder()
        .setName('order')
        .setDescription('ระบบ POS แบบตะกร้าสินค้า (เชื่อมต่อ Backend API)'),

    async execute(interaction) {
        try {
            const userName = interaction.user.globalName || interaction.user.username;

            // 🛒 State Variables
            let cart = {};
            let isPaid = false;
            let isRemoveMode = false;

            /* ===== Function สร้างหน้าจอ UI ===== */
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
                        { name: '⚙️ โหมดทำงาน', value: isRemoveMode ? '⛔ กำลังลบสินค้า' : '➕ กำลังเพิ่มสินค้า', inline: true }
                    );

                const availableKeys = isRemoveMode ? Object.keys(cart) : Object.keys(PRODUCTS);

                if (isRemoveMode && availableKeys.length === 0) {
                    isRemoveMode = false;
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

                const components = [];

                if (productOptions.length > 0) {
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(isRemoveMode ? 'remove_product_menu' : 'add_product_menu')
                            .setPlaceholder(isRemoveMode ? '⛔ เลือกสินค้าเพื่อลดจำนวน' : '➕ เลือกสินค้าเพื่อเพิ่มลงตะกร้า')
                            .addOptions(productOptions)
                    ));
                }

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_toggle_mode').setLabel(isRemoveMode ? 'กลับไปโหมดเพิ่ม' : 'เปลี่ยนเป็นโหมดลด').setStyle(isRemoveMode ? ButtonStyle.Secondary : ButtonStyle.Primary).setEmoji('🔄'),
                    new ButtonBuilder().setCustomId('btn_clear').setLabel('ล้าง').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                    new ButtonBuilder().setCustomId('btn_toggle_payment').setLabel(isPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย').setStyle(isPaid ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('💳'),
                    new ButtonBuilder().setCustomId('btn_checkout').setLabel(`ยืนยัน (${totalItems})`).setStyle(ButtonStyle.Success).setDisabled(totalItems === 0).setEmoji('✅')
                ));

                return { embeds: [embed], components };
            };

            const response = await interaction.reply({ ...renderInterface(), withResponse: true });

            const collector = response.resource.message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300000,
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'add_product_menu') {
                    const key = i.values[0];
                    if (!cart[key]) cart[key] = 0;
                    cart[key] += 1;
                    await i.update(renderInterface());
                }

                if (i.customId === 'remove_product_menu') {
                    const key = i.values[0];
                    if (cart[key]) {
                        cart[key] -= 1;
                        if (cart[key] <= 0) delete cart[key];
                    }
                    if (Object.keys(cart).length === 0) isRemoveMode = false;
                    await i.update(renderInterface());
                }

                if (i.customId === 'btn_toggle_mode') {
                    if (!isRemoveMode && Object.keys(cart).length === 0) {
                        return i.reply({ content: '⚠️ ตะกร้าว่างเปล่า ไม่สามารถเข้าโหมดลดสินค้าได้ครับ', ephemeral: true });
                    }
                    isRemoveMode = !isRemoveMode;
                    await i.update(renderInterface());
                }

                if (i.customId === 'btn_clear') {
                    cart = {};
                    isRemoveMode = false;
                    await i.update(renderInterface());
                }

                if (i.customId === 'btn_toggle_payment') {
                    isPaid = !isPaid;
                    await i.update(renderInterface());
                }

                // ✅ ยืนยัน (Checkout) - ยิงเข้า API Backend
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

                        // 1. เตรียมข้อมูลสินค้าให้ตรงกับ Format ที่ Backend ต้องการ
                        let apiItems = [];
                        let totalPrice = 0;

                        for (const [key, qty] of Object.entries(cart)) {
                            const p = PRODUCTS[key];
                            if (p) {
                                apiItems.push({
                                    id: p.id,       // ID จาก Database (สำคัญ!)
                                    name: p.name,
                                    quantity: qty,
                                    price: p.price
                                });
                                totalPrice += (p.price * qty);
                            }
                        }

                        // 2. สร้าง Payload ส่งไป Backend
                        const orderPayload = {
                            customerName: customerName,
                            totalAmount: totalPrice,
                            paymentMethod: isPaid ? 'Cash' : 'Pending', // ถ้าจ่ายแล้วส่ง Cash
                            items: apiItems
                        };

                        // 3. ยิง API (Axios) 🚀
                        // ⚠️ ถ้า Backend รัน port อื่น แก้เลข 4000 เป็นเลขนั้นนะครับ
                        const apiResponse = await axios.post('http://localhost:4000/api/orders', orderPayload);
                        const orderId = apiResponse.data.id;

                        // 4. สร้างข้อความสรุป (ดึงข้อมูลจากที่ส่งไป)
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

                        await submit.editReply({ content: summary, embeds: [], components: [] });
                        collector.stop();

                    } catch (e) {
                        console.error('❌ Error sending to API:', e.message);
                        if (e.response) {
                            console.error('API Response:', e.response.data);
                        }
                        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาดในการส่งข้อมูลไปที่ Backend (เช็ค Console หรือดูว่าเปิด Server หรือยัง)', ephemeral: true });
                    }
                }
            });

        } catch (err) {
            console.error('❌ Execute Error:', err);
            if (!interaction.replied) await interaction.reply({ content: '❌ Error executing command', ephemeral: true });
        }
    },
};