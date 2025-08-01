// Simple rental system backend - Final version using a 'public' directory
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- PATH CONFIGURATION (The Correct Way) ---
// 1. Define the absolute path to the 'public' directory where all static assets are.
const publicPath = path.join(__dirname, 'public');

// 2. Define the absolute paths to your data files in the project root.
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

// 3. Tell Express to serve all static files from the 'public' directory.
// Any request for a file (e.g., /style.css, /script.js, /admin.html) will be looked for here.
app.use(express.static(publicPath));


// --- DATA INITIALIZATION ---
async function initializeData() {
    // Initialize rentals.json if it doesn't exist
    try {
        await fs.access(RENTALS_FILE);
    } catch {
        await fs.writeFile(RENTALS_FILE, JSON.stringify([]));
    }
    
    // Initialize generators.json if it doesn't exist
    try {
        await fs.access(GENERATORS_FILE);
    } catch {
        const generators = [
            { id: 1, name: "Aggregaatti 1", is_available: true, is_active: true },
            { id: 2, name: "Aggregaatti 2", is_available: true, is_active: true },
            { id: 3, name: "Aggregaatti 3", is_available: true, is_active: true }
        ];
        await fs.writeFile(GENERATORS_FILE, JSON.stringify(generators));
    }
}

// --- HELPER FUNCTIONS ---
async function readData(file) {
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
}

async function writeData(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// --- API ENDPOINTS ---
// (No changes are needed in this section. It remains the same.)

// Create rental request
app.post('/api/rentals', async (req, res) => {
    try {
        const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
        const rentals = await readData(RENTALS_FILE);
        
        const newRental = {
            id: Date.now(),
            name, email, phone,
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
        await writeData(RENTALS_FILE, rentals);
        
        res.status(201).json({ 
            id: newRental.id,
            message: 'Rental request created successfully' 
        });
    } catch (err) {
        console.error('Error creating rental:', err);
        res.status(500).json({ error: 'Failed to create rental request.' });
    }
});

// Get all rentals (for admin)
app.get('/api/admin/rentals', async (req, res) => {
    try {
        const status = req.query.status || 'all';
        let rentals = await readData(RENTALS_FILE);
        
        if (status !== 'all') {
            rentals = rentals.filter(r => r.status === status);
        }
        
        rentals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(rentals);
    } catch (err) {
        console.error('Error getting rentals:', err);
        res.status(500).json({ error: 'Failed to retrieve rentals.' });
    }
});

// Delete a rental
app.delete('/api/rentals/:id', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        let rentals = await readData(RENTALS_FILE);
        let generators = await readData(GENERATORS_FILE);

        const rentalIndex = rentals.findIndex(r => r.id === rentalId);
        if (rentalIndex === -1) {
            return res.status(404).json({ error: 'Rental not found' });
        }

        const rentalToDelete = rentals[rentalIndex];

        if (rentalToDelete.generator_id) {
            const generator = generators.find(g => g.id === rentalToDelete.generator_id);
            if (generator) {
                generator.is_available = true;
                await writeData(GENERATORS_FILE, generators);
            }
        }

        rentals.splice(rentalIndex, 1);
        await writeData(RENTALS_FILE, rentals);

        res.json({ message: 'Rental deleted successfully' });
    } catch (err) {
        console.error('Error deleting rental:', err);
        res.status(500).json({ error: 'Failed to delete rental.' });
    }
});

// Approve a rental
app.post('/api/rentals/:id/approve', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const rental = rentals.find(r => r.id === rentalId);

        if (rental && rental.status === 'pending') {
            rental.status = 'approved';
            await writeData(RENTALS_FILE, rentals);
            console.log(`SIMULATING: Sending approval SMS and Email to ${rental.phone} / ${rental.email}`);
            res.json({ message: 'Rental approved and notifications sent.' });
        } else {
            res.status(404).json({ error: 'Rental not found or not in pending state.' });
        }
    } catch (err) {
        console.error('Error approving rental:', err);
        res.status(500).json({ error: 'Failed to approve rental.' });
    }
});


// Send invoice
app.post('/api/rentals/:id/invoice', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const rental = rentals.find(r => r.id === rentalId);

        if (rental && rental.status === 'approved') {
            rental.status = 'invoiced';
            await writeData(RENTALS_FILE, rentals);
            res.json({ message: 'Invoice sent successfully' });
        } else {
            res.status(404).json({ error: 'Rental not found or not approved.' });
        }
    } catch (err) {
        console.error('Error sending invoice:', err);
        res.status(500).json({ error: 'Failed to send invoice.' });
    }
});

// Mark as paid and assign a generator
app.post('/api/rentals/:id/paid', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const generators = await readData(GENERATORS_FILE);
        const rental = rentals.find(r => r.id === rentalId);

        if (!rental) return res.status(404).json({ error: 'Rental not found' });
        
        const availableGen = generators.find(g => g.is_active && g.is_available);
        if (!availableGen) {
            return res.status(400).json({ error: 'No generators available to assign.' });
        }
        
        rental.status = 'paid';
        rental.generator_id = availableGen.id;
        availableGen.is_available = false;
        
        await writeData(RENTALS_FILE, rentals);
        await writeData(GENERATORS_FILE, generators);
        
        res.json({ message: 'Payment recorded', generatorId: availableGen.id });
    } catch (err) {
        console.error('Error marking as paid:', err);
        res.status(500).json({ error: 'Failed to mark as paid.' });
    }
});

// Get generator status and availability
app.get('/api/generators/availability', async (req, res) => {
    try {
        const generators = await readData(GENERATORS_FILE);
        const availableCount = generators.filter(g => g.is_active && g.is_available).length;
        
        res.json({ 
            total: generators.length,
            available: availableCount,
            details: generators
        });
    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: 'Failed to check availability.' });
    }
});

// Toggle a generator's active status
app.post('/api/generators/:id/toggle-active', async (req, res) => {
    try {
        const generatorId = parseInt(req.params.id);
        const generators = await readData(GENERATORS_FILE);
        const generator = generators.find(g => g.id === generatorId);

        if (generator) {
            generator.is_active = !generator.is_active;
            await writeData(GENERATORS_FILE, generators);
            res.json({ message: `Generator ${generatorId} status updated.`, generator });
        } else {
            res.status(404).json({ error: 'Generator not found' });
        }
    } catch (err) {
        console.error('Error toggling generator status:', err);
        res.status(500).json({ error: 'Failed to toggle generator status.' });
    }
});

// Return a generator
app.post('/api/generators/:id/return', async (req, res) => {
    try {
        const generatorId = parseInt(req.params.id);
        const generators = await readData(GENERATORS_FILE);
        const generator = generators.find(g => g.id === generatorId);

        if (generator) {
            generator.is_available = true;
            await writeData(GENERATORS_FILE, generators);
            res.json({ message: 'Generator returned successfully' });
        } else {
            res.status(404).json({ error: 'Generator not found' });
        }
    } catch (err) {
        console.error('Error returning generator:', err);
        res.status(500).json({ error: 'Failed to return generator.' });
    }
});


// --- SERVE HTML PAGES ---
// Since we are using express.static(publicPath), Express will automatically
// serve index.html for '/' requests. This catch-all is a fallback for
// client-side routing, ensuring that direct navigation to /admin still works.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


// --- STARTUP ---
initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Serving static files from: ${publicPath}`);
        console.log(`Reading data files from project root: ${__dirname}`);
    });
}).catch(err => {
    console.error('Failed to initialize data files:', err);
    process.exit(1); // Exit the process if data files can't be set up
});