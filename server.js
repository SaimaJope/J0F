// Simple rental system backend - Fixed for production
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Define the absolute path to the 'public' directory
const publicPath = path.join(__dirname, 'public');

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Serve static files ONLY from the 'public' directory
app.use(express.static(publicPath));

// Data file paths (using absolute paths for robustness)
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

// --- DATA INITIALIZATION ---
async function initializeData() {
    try {
        await fs.access(RENTALS_FILE);
    } catch {
        await fs.writeFile(RENTALS_FILE, JSON.stringify([]));
    }
    
    try {
        await fs.access(GENERATORS_FILE);
    } catch {
        const generators = [
            { id: 1, name: "Generator 1", is_available: true },
            { id: 2, name: "Generator 2", is_available: true },
            { id: 3, name: "Generator 3", is_available: true }
        ];
        await fs.writeFile(GENERATORS_FILE, JSON.stringify(generators));
    }
}

// --- HELPER FUNCTIONS ---
async function readRentals() {
    const data = await fs.readFile(RENTALS_FILE, 'utf-8');
    return JSON.parse(data);
}

async function writeRentals(rentals) {
    await fs.writeFile(RENTALS_FILE, JSON.stringify(rentals, null, 2));
}

async function readGenerators() {
    const data = await fs.readFile(GENERATORS_FILE, 'utf-8');
    return JSON.parse(data);
}

async function writeGenerators(generators) {
    await fs.writeFile(GENERATORS_FILE, JSON.stringify(generators, null, 2));
}

// --- API ENDPOINTS ---

// Create rental request
app.post('/api/rentals', async (req, res) => {
    try {
        const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
        const rentals = await readRentals();
        
        const newRental = {
            id: Date.now(),
            name,
            email,
            phone,
            start_date: startDate,
            end_date: endDate,
            delivery_type: delivery,
            address: address || '',
            price: parseFloat(price),
            status: 'pending',
            created_at: new Date().toISOString(),
            generator_id: null
        };
        
        rentals.push(newRental);
        await writeRentals(rentals);
        
        res.json({ 
            id: newRental.id,
            message: 'Rental request created successfully' 
        });
    } catch (err) {
        console.error('Error creating rental:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all rentals (for admin)
app.get('/api/admin/rentals', async (req, res) => {
    try {
        const status = req.query.status || 'all';
        let rentals = await readRentals();
        
        if (status !== 'all') {
            rentals = rentals.filter(r => r.status === status);
        }
        
        rentals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(rentals);
    } catch (err) {
        console.error('Error getting rentals:', err);
        res.status(500).json({ error: err.message });
    }
});

// Send invoice
app.post('/api/rentals/:id/invoice', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readRentals();
        
        const rental = rentals.find(r => r.id === rentalId);
        if (rental) {
            rental.status = 'invoiced';
            await writeRentals(rentals);
            res.json({ message: 'Invoice sent successfully' });
        } else {
            res.status(404).json({ error: 'Rental not found' });
        }
    } catch (err) {
        console.error('Error sending invoice:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mark as paid and assign a generator
app.post('/api/rentals/:id/paid', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readRentals();
        const generators = await readGenerators();
        
        const rental = rentals.find(r => r.id === rentalId);
        if (!rental) {
            return res.status(404).json({ error: 'Rental not found' });
        }
        
        const availableGen = generators.find(g => g.is_available);
        if (!availableGen) {
            return res.status(400).json({ error: 'No generators available' });
        }
        
        rental.status = 'paid';
        rental.generator_id = availableGen.id;
        availableGen.is_available = false;
        
        await writeRentals(rentals);
        await writeGenerators(generators);
        
        res.json({ 
            message: 'Payment recorded',
            generatorId: availableGen.id 
        });
    } catch (err) {
        console.error('Error marking as paid:', err);
        res.status(500).json({ error: err.message });
    }
});

// Check generator availability
app.get('/api/generators/availability', async (req, res) => {
    try {
        const generators = await readGenerators();
        const available = generators.filter(g => g.is_available).length;
        
        res.json({ 
            total: generators.length,
            available: available,
            unavailable: generators.length - available
        });
    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: err.message });
    }
});

// Return a generator
app.post('/api/generators/:id/return', async (req, res) => {
    try {
        const generatorId = parseInt(req.params.id);
        const generators = await readGenerators();
        
        const generator = generators.find(g => g.id === generatorId);
        if (generator) {
            generator.is_available = true;
            await writeGenerators(generators);
            res.json({ message: 'Generator returned successfully' });
        } else {
            res.status(404).json({ error: 'Generator not found' });
        }
    } catch (err) {
        console.error('Error returning generator:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- SERVE HTML PAGES ---
// These routes ensure that visiting your site's root or /admin serves the correct HTML file.
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// --- CATCH-ALL & STARTUP ---
app.use((req, res, next) => {
    console.log(`404 Not Found: ${req.method} ${req.url}`);
    res.status(404).send('Not Found');
});

initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Static files served from: ${publicPath}`); // Corrected log
    });
}).catch(err => {
    console.error('Failed to initialize data files:', err);
});