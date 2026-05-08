const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Fungsi inisialisasi tabel otomatis saat pertama kali dijalankan
const initDB = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id BIGINT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                location_name VARCHAR(255),
                latitude VARCHAR(50),
                longitude VARCHAR(50),
                image_url VARCHAR(500),
                evidence_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        connection.release();
        console.log("✅ Database RDS Terkoneksi & Tabel Siap.");
    } catch (err) {
        console.error("❌ Gagal Inisialisasi RDS:", err.message);
    }
};

initDB();

module.exports = pool;