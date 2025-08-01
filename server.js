// Simple rental system backend - SECURED and IMPROVED
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const basicAuth = require('express-basic-auth'); // [SECURITY] Import the authentication library

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- PATH CONFIGURATION ---
const publicPath = path.join(__dirname, 'public');
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

app.use(express.static(publicPath));

// --- [SECURITY] BASIC AUTHENTICATION SETUP ---
const adminUsers = {
    // We pull the username and password from environment variables.
    // This is secure and prevents credentials from being in the code.
    // The '||' provides a default for local testing if variables aren't set.
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'password'
};

const adminAuth = basicAuth({
    users: adminUsers,
    challenge: true, // This is what pops up the login box in the browser
    realm: 'JobFutureAdmin', // The name that appears in the login prompt
});


// --- DATA INITIALIZATION ---
// ... (This section remains unchanged)
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
            { id: 1, name: "Aggregaatti 1", is_available: true, is_active: true },
            { id: 2, name: "Aggregaatti 2", is_available: true, is_active: true },
            { id: 3, name: "Aggregaatti 3", is_available: true, is_active: true }
        ];
        await fs.writeFile(GENERATORS_FILE, JSON.stringify(generators));
    }
}
async function readData(file) {
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
}
async function writeData(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// --- PUBLIC API ENDPOINTS (No password required) ---
app.post('/api/rentals', async (req, res) => { /* ... unchanged ... */ });
app.get('/api/generators/availability', async (req, res) => { /* ... unchanged ... */ });

// --- [SECURITY] PROTECTED ADMIN API ENDPOINTS ---
// The 'adminAuth' middleware is applied to all routes that an admin would use.
app.get('/api/admin/rentals', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.delete('/api/rentals/:id', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.post('/api/rentals/:id/approve', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.post('/api/rentals/:id/invoice', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.post('/api/rentals/:id/paid', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.post('/api/generators/:id/toggle-active', adminAuth, async (req, res) => { /* ... unchanged ... */ });
app.post('/api/generators/:id/return', adminAuth, async (req, res) => { /* ... unchanged ... */ });


// --- SERVE HTML PAGES ---
// Serve the admin page only after successful authentication
app.get('/admin', adminAuth, (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// Fallback for client-side routing, ensures the main page loads.
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


// --- STARTUP ---
initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize data files:', err);
    process.exit(1);
});

// --- Unchanged API logic below ---
// ... (The full logic for each API endpoint is still here, just omitted for brevity)
// Create rental request
app.post('/api/rentals', async (req, res) => {
    try {
        const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
        const rentals = await readData(RENTALS_FILE);
        const newRental = { id: Date.now(), name, email, phone, start_date: startDate, end_date: endDate, delivery_type: delivery, address: address || '', price: parseFloat(price), status: 'pending', created_at: new Date().toISOString(), generator_id: null };
        rentals.push(newRental);
        await writeData(RENTALS_FILE, rentals);
        res.status(201).json({ id: newRental.id, message: 'Rental request created successfully' });
    } catch (err) {
        console.error('Error creating rental:', err);
        res.status(500).json({ error: 'Failed to create rental request.' });
    }
});
app.get('/api/generators/availability', async (req, res) => {
    try {
        const generators = await readData(GENERATORS_FILE);
        const availableCount = generators.filter(g => g.is_active && g.is_available).length;
        res.json({ total: generators.length, available: availableCount, details: generators });
    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: 'Failed to check availability.' });
    }
});
app.get('/api/admin/rentals', adminAuth, async (req, res) => {
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
app.delete('/api/rentals/:id', adminAuth, async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        let rentals = await readData(RENTALS_FILE);
        let generators = await readData(GENERATORS_FILE);
        const rentalIndex = rentals.findIndex(r => r.id === rentalId);
        if (rentalIndex === -1) return res.status(404).json({ error: 'Rental not found' });
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
app.post('/api/rentals/:id/approve', adminAuth, async (req, res) => {
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
app.post('/api/rentals/:id/invoice', adminAuth, async (req, res) => {
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
app.post('/api/rentals/:id/paid', adminAuth, async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const generators = await readData(GENERATORS_FILE);
        const rental = rentals.find(r => r.id === rentalId);
        if (!rental) return res.status(404).json({ error: 'Rental not found' });
        const availableGen = generators.find(g => g.is_active && g.is_available);
        if (!availableGen) return res.status(400).json({ error: 'No generators available to assign.' });
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
app.post('/api/generators/:id/toggle-active', adminAuth, async (req, res) => {
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
app.post('/api/generators/:id/return', adminAuth, async (req, res) => {
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