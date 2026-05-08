require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('./config/db');
const { uploadToS3 } = require('./config/s3');

const app = express();

// Multer menggunakan MemoryStorage karena file akan diteruskan ke S3
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES ---

app.get('/', (req, res) => res.render('landing'));

// Dashboard: Ambil data dari RDS
app.get('/dashboard', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports ORDER BY id DESC");
        res.render('index', { reports: rows });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

app.get('/reports', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports");
        res.render('reports', { reports: rows });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

app.get('/reports/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).send("Not Found");
        res.render('detail', { report: rows[0] });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// Create Report: Upload ke S3 & Insert ke RDS
app.post('/report', upload.single('image'), async (req, res) => {
    const { title, description, location, latitude, longitude } = req.body;
    try {
        let imageUrl = null;
        if (req.file) {
            imageUrl = await uploadToS3(req.file);
        }

        await db.query(
            "INSERT INTO reports (id, title, description, location_name, latitude, longitude, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [Date.now(), title, description, location, latitude, longitude, imageUrl]
        );
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Upload/DB Error: " + err.message);
    }
});

// Verify Report: Update status di RDS & Upload bukti ke S3
app.post('/reports/:id/verify', upload.single('evidence'), async (req, res) => {
    try {
        let evidenceUrl = null;
        if (req.file) {
            evidenceUrl = await uploadToS3(req.file);
        }

        await db.query(
            "UPDATE reports SET status = 'Selesai', evidence_url = ? WHERE id = ?",
            [evidenceUrl, req.params.id]
        );
        res.redirect(`/reports/${req.params.id}`);
    } catch (err) {
        res.status(500).send("Update Error");
    }
});

app.post('/reports/:id/delete', async (req, res) => {
    try {
        await db.query("DELETE FROM reports WHERE id = ?", [req.params.id]);
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Delete Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 LaporIn Cloud Server is Running on port ${PORT}`);
});