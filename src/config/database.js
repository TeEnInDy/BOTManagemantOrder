const mysql = require('mysql2/promise'); // ใช้แบบ Promise เพื่อความเสถียร

// สร้าง Pool เพื่อจัดการการเชื่อมต่อแบบคิว (ดีกว่า createConnection)
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'botdiscord',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10, // รองรับคนกดพร้อมกันได้ 10 คิว
    queueLimit: 0
});

module.exports = pool;