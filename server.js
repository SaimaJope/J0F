// =================================================================
// JobFuture Rental System Backend
// Final Version: Secure, Session-Based Authentication
// =================================================================

// --- 1. IMPORTS ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const session = require('express-session'); // For session-based login

// --- 2. INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. PATH CONFIGURATION ---
// This robustly defines paths, working both locally and on Render.
const publicPath = path.join(__dirname, 'public');
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

// --- 4. CORE MIDDLEWARE ---
app.use(cors()); // Allows cross-origin requests
app.use(express.json()); // Parses incoming JSON payloads
app.use(express.urlencoded({ extended: true })); // Parses form data from the login page
app.use(express.static(publicPath)); // Serves all static files (HTML, CSS, images) from the 'public' directory

// --- 5. SESSION AUTHENTICATION SETUP ---
// This is the heart of the secure login system.
app.use(session({
    // The secret is used to sign the session ID cookie. Use a long, random string.
    secret: process.env.SESSION_SECRET || 'a-very-strong-default-secret-for-local-testing',
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        secure: process.env.NODE_ENV === 'production', // In production (on Render), only send cookie over HTTPS
        httpOnly: true, // IMPORTANT: Prevents client-side JS from accessing the cookie, mitigating XSS attacks.
        maxAge: 1000 * 60 * 60 * 24 // Cookie is valid for 24 hours
    }
}));

// Custom middleware to check if a user is authenticated.
// This function acts as a gatekeeper for all protected routes.
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        // The user has a valid session. Proceed to the requested route.
        next();
    } else {
        // No valid session. Redirect to the login page.
        res.redirect('/login');
    }
};

// --- 6. AUTHENTICATION ROUTES ---
// Serves the login page.
app.get('/login', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

// Handles the login form submission.
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Securely get credentials from environment variables, with defaults for local testing.
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';

    if (username === adminUser && password === adminPass) {
        // Credentials are valid. Create a user object on the session.
        req.session.user = { username: username };
        // Redirect the user to the admin panel.
        res.redirect('/admin');
    } else {
        // Invalid credentials. Send them back to the login page to try again.
        res.redirect('/login');
    }
});

// Handles logging out.
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            // If there's an error destroying the session, redirect to admin anyway.
            return res.redirect('/admin');
        }
        // Clear the session cookie and redirect to the login page.
        res.clearCookie('connect.sid'); // 'connect.sid' is the default session cookie name
        res.redirect('/login');
    });
});


// --- 7. PUBLIC API ENDPOINTS (No Login Required) ---

// Create a new rental request.
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

// Get public availability of generators.
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


// --- 8. PROTECTED ADMIN API ENDPOINTS (Login Required) ---
// All routes in this section use the 'isAuthenticated' middleware gatekeeper.

// Get all rental information for the admin panel.
app.get('/api/admin/rentals', isAuthenticated, async (req, res) => {
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

// Delete a rental.
app.delete('/api/rentals/:id', isAuthenticated, async (req, res) => {
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

// Approve a rental.
app.post('/api/rentals/:id/approve', isAuthenticated, async (req, res) => {
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

// Mark a rental as invoiced.
app.post('/api/rentals/:id/invoice', isAuthenticated, async (req, res) => {
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

// Mark a rental as paid and assign a generator.
app.post('/api/rentals/:id/paid', isAuthenticated, async (req, res) => {
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

// Toggle a generator's active status (in service / out of service).
app.post('/api/generators/:id/toggle-active', isAuthenticated, async (req, res) => {
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

// Return a generator, making it available again.
app.post('/api/generators/:id/return', isAuthenticated, async (req, res) => {
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


// --- 9. HTML PAGE SERVING ---

// Serve the admin panel, but only if the user is authenticated.
app.get('/admin', isAuthenticated, (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// Serve the main public-facing homepage.
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// --- 10. DATA HELPERS & SERVER STARTUP ---

// Function to initialize data files if they don't exist.
async function initializeData() {
    try {
        await fs.access(RENTALS_FILE);
    } catch {
        await fs.writeFile(RENTALS_FILE, JSON.stringify([]));
    }
    try {
        await fs.access(GENERATORS_FILE);
    } catch {
        const initialGenerators = [
            { id: 1, name: "Aggregaatti 1", is_available: true, is_active: true },
            { id: 2, name: "Aggregaatti 2", is_available: true, is_active: true },
            { id: 3, name: "Aggregaatti 3", is_available: true, is_active: true }
        ];
        await fs.writeFile(GENERATORS_FILE, JSON.stringify(initialGenerators));
    }
}

// Helper function to read JSON data.
async function readData(file) {
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
}

// Helper function to write JSON data.
async function writeData(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Initialize data and then start the server.
initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Serving static files from: ${publicPath}`);
    });
}).catch(err => {
    console.error('FATAL: Failed to initialize data files. Server not started.', err);
    process.exit(1);
});