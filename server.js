// Simple rental system backend - Clean, functional, Nordic simplicity
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Clean and essential
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve your HTML/CSS/JS files from 'public' folder

// Initialize SQLite database - Simple, file-based, perfect for beginners
const db = new sqlite3.Database('./rentals.db');

// Create tables if they don't exist
db.serialize(() => {
    // Rental requests table
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        delivery_type TEXT NOT NULL,
        address TEXT,
        price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        generator_id INTEGER
    )`);
    
    // Generators table - Track your 3 generators
    db.run(`CREATE TABLE IF NOT EXISTS generators (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        is_available INTEGER DEFAULT 1
    )`);
    
    // Initialize 3 generators if not exists
    db.get("SELECT COUNT(*) as count FROM generators", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO generators (name) VALUES (?)");
            stmt.run("Generator 1");
            stmt.run("Generator 2");
            stmt.run("Generator 3");
            stmt.finalize();
        }
    });
});

// API ENDPOINTS - Clean, RESTful design

// 1. Create rental request (from your existing form)
app.post('/api/rentals', (req, res) => {
    const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
    
    db.run(
        `INSERT INTO rentals (name, email, phone, start_date, end_date, delivery_type, address, price) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, startDate, endDate, delivery, address || '', parseFloat(price)],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                id: this.lastID,
                message: 'Rental request created successfully' 
            });
        }
    );
});

// 2. Get all rentals (for admin)
app.get('/api/admin/rentals', (req, res) => {
    const status = req.query.status || 'all';
    let query = "SELECT * FROM rentals";
    
    if (status !== 'all') {
        query += " WHERE status = ?";
    }
    
    query += " ORDER BY created_at DESC";
    
    db.all(query, status !== 'all' ? [status] : [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 3. Send invoice (update status to 'invoiced')
app.post('/api/rentals/:id/invoice', (req, res) => {
    const rentalId = req.params.id;
    
    // In real implementation, you would:
    // 1. Generate PDF invoice
    // 2. Send email with PDF attachment
    // For now, we just update the status
    
    db.run(
        "UPDATE rentals SET status = 'invoiced' WHERE id = ?",
        [rentalId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Simulate email sending
            console.log(`Invoice sent for rental ${rentalId}`);
            res.json({ message: 'Invoice sent successfully' });
        }
    );
});

// 4. Mark as paid (for mobile/desktop app)
app.post('/api/rentals/:id/paid', (req, res) => {
    const rentalId = req.params.id;
    
    db.serialize(() => {
        // Start transaction
        db.run("BEGIN TRANSACTION");
        
        // Get rental details
        db.get("SELECT * FROM rentals WHERE id = ?", [rentalId], (err, rental) => {
            if (err || !rental) {
                db.run("ROLLBACK");
                res.status(404).json({ error: 'Rental not found' });
                return;
            }
            
            // Find available generator
            db.get("SELECT id FROM generators WHERE is_available = 1 LIMIT 1", (err, generator) => {
                if (err || !generator) {
                    db.run("ROLLBACK");
                    res.status(400).json({ error: 'No generators available' });
                    return;
                }
                
                // Update rental with generator assignment
                db.run(
                    "UPDATE rentals SET status = 'paid', generator_id = ? WHERE id = ?",
                    [generator.id, rentalId],
                    (err) => {
                        if (err) {
                            db.run("ROLLBACK");
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        
                        // Mark generator as unavailable
                        db.run(
                            "UPDATE generators SET is_available = 0 WHERE id = ?",
                            [generator.id],
                            (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    res.status(500).json({ error: err.message });
                                    return;
                                }
                                
                                db.run("COMMIT");
                                res.json({ 
                                    message: 'Payment recorded',
                                    generatorId: generator.id 
                                });
                            }
                        );
                    }
                );
            });
        });
    });
});

// 5. Check generator availability
app.get('/api/generators/availability', (req, res) => {
    const { startDate, endDate } = req.query;
    
    // For MVP, we'll just count available generators
    // In production, you'd check date overlaps
    db.get(
        "SELECT COUNT(*) as available FROM generators WHERE is_available = 1",
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                total: 3,
                available: row.available,
                unavailable: 3 - row.available
            });
        }
    );
});

// 6. Return generator (for admin/app)
app.post('/api/generators/:id/return', (req, res) => {
    const generatorId = req.params.id;
    
    db.run(
        "UPDATE generators SET is_available = 1 WHERE id = ?",
        [generatorId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Generator returned successfully' });
        }
    );
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} for the main site`);
    console.log(`Visit http://localhost:${PORT}/admin for the admin panel`);
});