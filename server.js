require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session'); // Tambahkan ini untuk login
const db = require('./config/db');
const { uploadToS3 } = require('./config/s3');

const app = express();

// --- MIDDLEWARE ---
// Session untuk login admin
app.use(session({
    secret: process.env.SESSION_SECRET || 'laporin-cloud-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set ke true jika menggunakan HTTPS murni
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multer menggunakan MemoryStorage karena file akan diteruskan ke S3
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// Middleware pengaman untuk cek status admin di setiap request
const checkAdmin = (req, res, next) => {
    res.locals.admin = req.session.admin || false;
    next();
};

app.use(checkAdmin);

// --- ROUTES ---

// Landing Page
app.get('/', (req, res) => res.render('landing'));

// Dashboard: Menampilkan semua laporan
app.get('/dashboard', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports ORDER BY id DESC");
        res.render('index', { 
            reports: rows,
            admin: req.session.admin || false 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

// Peta Fasilitas (Halaman khusus peta)
app.get('/reports', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports");
        res.render('reports', { 
            reports: rows,
            admin: req.session.admin || false 
        });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// Detail Laporan
app.get('/reports/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM reports WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).send("Not Found");
        
        res.render('detail', { 
            report: rows[0],
            admin: req.session.admin || false 
        });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

// Login Admin
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Menggunakan ENV untuk password admin agar lebih aman
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin123';

    if (username === adminUser && password === adminPass) {
        req.session.admin = true;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'Username atau Password salah!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
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

// Verify Report (Admin Only)
app.post('/reports/:id/verify', upload.single('evidence'), async (req, res) => {
    if (!req.session.admin) return res.status(403).send("Unauthorized");
    
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

// Delete Report (Admin Only)
app.post('/reports/:id/delete', async (req, res) => {
    if (!req.session.admin) return res.status(403).send("Unauthorized");

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