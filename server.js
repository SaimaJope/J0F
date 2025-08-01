// Simple rental system backend - Updated for new features
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Define the absolute path to the 'public' directory
const publicPath = path.resolve(__dirname); // Serve from root

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS, images) from the root project directory
app.use(express.static(publicPath));

// Data file paths
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

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
        // Future-proofing: This structure can be expanded with more item types
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
            status: 'pending', // Initial status
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

// [NEW] Delete a rental
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

        // If the deleted rental had a generator assigned, make it available again
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

// [NEW] Approve a rental (simulates sending notifications)
app.post('/api/rentals/:id/approve', async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const rental = rentals.find(r => r.id === rentalId);

        if (rental && rental.status === 'pending') {
            rental.status = 'approved';
            await writeData(RENTALS_FILE, rentals);

            // --- NOTIFICATION LOGIC ---
            // In a real application, you would integrate with services like Twilio (SMS) and SendGrid (Email) here.
            console.log(`SIMULATING: Sending approval SMS and Email to ${rental.phone} / ${rental.email}`);
            console.log(`Message: Your booking #${rental.id} is approved. Contains terms and pickup info.`);
            // --- END NOTIFICATION LOGIC ---

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
        
        // Find a generator that is both active (in service) and available
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
        // Available for rent = active (in service) AND available (not rented)
        const availableCount = generators.filter(g => g.is_active && g.is_available).length;
        
        res.json({ 
            total: generators.length,
            available: availableCount,
            details: generators // Send full details for admin page
        });
    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: 'Failed to check availability.' });
    }
});

// [NEW] Toggle a generator's active status (in service / out of service)
app.post('/api/generators/:id/toggle-active', async (req, res) => {
    try {
        const generatorId = parseInt(req.params.id);
        const generators = await readData(GENERATORS_FILE);
        const generator = generators.find(g => g.id === generatorId);

        if (generator) {
            generator.is_active = !generator.is_active; // Toggle status
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

// Return a generator (makes it available again)
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
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// --- CATCH-ALL & STARTUP ---
app.use((req, res, next) => {
    res.status(404).send('Not Found');
});

initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize data files:', err);
});