// =================================================================
// JobFuture Rental System Backend
// Final Production Version - Correct & Secure Architecture
// =================================================================

// --- 1. IMPORTS ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const session = require('express-session');

// --- 2. INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. PATH DEFINITIONS ---
// Define absolute paths to our directories to prevent any ambiguity.
const publicPath = path.join(__dirname, 'public'); // For truly public assets (CSS, images)
const viewsPath = path.join(__dirname, 'views');   // For protected HTML pages
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

// --- 4. CORE MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: This line ONLY serves assets from the 'public' directory.
// It CANNOT access the 'views' directory. This is key to our security.
app.use(express.static(publicPath));

// --- 5. SESSION AUTHENTICATION SETUP ---
// Trust the first proxy in front of the app (essential for platforms like Render/Heroku)
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-default-secret-for-local-testing',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// --- 6. SECURITY GATEKEEPER MIDDLEWARE ---
// This function checks if a user is logged in. It will protect our routes.
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next(); // User is logged in, proceed.
    }
    // User is NOT logged in. Redirect them to the login page.
    res.redirect('/login');
};

// --- 7. ROUTE HANDLERS ---

// PAGE SERVING ROUTES
// A request to '/' is handled by the express.static middleware, which serves index.html from 'public'.

// Serves the login page. This route is public.
app.get('/login', (req, res) => {
    res.sendFile(path.join(viewsPath, 'login.html'));
});

// Serves the admin page. This route is PROTECTED by our isAuthenticated middleware.
// A user cannot get this page without a valid session.
app.get('/admin', isAuthenticated, (req, res) => {
    res.sendFile(path.join(viewsPath, 'admin.html'));
});

// AUTHENTICATION API ROUTES
// Handles the login form submission.
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';

    if (username === adminUser && password === adminPass) {
        // SUCCESS: Credentials are valid. Create a user object on the session.
        req.session.user = { username: username };
        // Redirect the user to the admin panel.
        res.redirect('/admin');
    } else {
        // FAILURE: Redirect back to the login page WITH an error flag.
        res.redirect('/login?error=true');
    }
});

// Handles logout.
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.redirect('/admin'); }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// PUBLIC API ROUTES
app.post('/api/rentals', async (req, res) => {
    try {
        const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
        const rentals = await readData(RENTALS_FILE);
        const newRental = { id: Date.now(), name, email, phone, start_date: startDate, end_date: endDate, delivery_type: delivery, address: address || '', price: parseFloat(price), status: 'pending', created_at: new Date().toISOString(), generator_id: null };
        rentals.push(newRental);
        await writeData(RENTALS_FILE, rentals);
        res.status(201).json({ id: newRental.id, message: 'Rental request created successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create rental request.' });
    }
});

app.get('/api/generators/availability', async (req, res) => {
    try {
        const generators = await readData(GENERATORS_FILE);
        const availableCount = generators.filter(g => g.is_active && g.is_available).length;
        res.json({ total: generators.length, available: availableCount, details: generators });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check availability.' });
    }
});

// Add this new route, maybe after the other public API routes
app.get('/api/rentals/booked-dates', async (req, res) => {
    try {
        const rentals = await readData(RENTALS_FILE);
        const activeGeneratorsCount = (await readData(GENERATORS_FILE)).filter(g => g.is_active).length;

        // [MODIFIED] Filter for rentals that are confirmed and occupy a generator
        // A generator is considered occupied if the rental is 'approved' or 'invoiced'
        const confirmedRentals = rentals.filter(r => 
            ['approved', 'invoiced'].includes(r.status)
        );

        // Extract the start and end dates
        const bookedPeriods = confirmedRentals.map(r => ({
            start: r.start_date,
            end: r.end_date
        }));

        res.json({
            bookedPeriods: bookedPeriods,
            activeGenerators: activeGeneratorsCount
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve booked dates.' });
    }
});


// PROTECTED ADMIN API ROUTES
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
        res.status(500).json({ error: 'Failed to retrieve rentals.' });
    }
});

app.delete('/api/rentals/:id', isAuthenticated, async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        let rentals = await readData(RENTALS_FILE);
        let generators = await readData(GENERATORS_FILE);
        const rentalIndex = rentals.findIndex(r => r.id === rentalId);
        if (rentalIndex === -1) return res.status(404).json({ error: 'Rental not found' });
        const rentalToDelete = rentals[rentalIndex];
        // If a generator was assigned, make it available again
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
        res.status(500).json({ error: 'Failed to delete rental.' });
    }
});

// [MODIFIED] Approving now assigns and reserves a generator
app.post('/api/rentals/:id/approve', isAuthenticated, async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const generators = await readData(GENERATORS_FILE);
        const rental = rentals.find(r => r.id === rentalId);
        if (!rental || rental.status !== 'pending') {
            return res.status(404).json({ error: 'Rental not found or not in pending state.' });
        }
        
        const availableGen = generators.find(g => g.is_active && g.is_available);
        if (!availableGen) {
            return res.status(400).json({ error: 'No generators available to assign.' });
        }
        
        rental.status = 'approved';
        rental.generator_id = availableGen.id;
        availableGen.is_available = false;
        
        await writeData(RENTALS_FILE, rentals);
        await writeData(GENERATORS_FILE, generators);
        
        res.json({ message: 'Rental approved and generator assigned', generatorId: availableGen.id });

    } catch (err) {
        res.status(500).json({ error: 'Failed to approve rental.' });
    }
});

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
        res.status(500).json({ error: 'Failed to send invoice.' });
    }
});

// [MODIFIED] Marking as paid now completes the rental and releases the generator
app.post('/api/rentals/:id/paid', isAuthenticated, async (req, res) => {
    try {
        const rentalId = parseInt(req.params.id);
        const rentals = await readData(RENTALS_FILE);
        const generators = await readData(GENERATORS_FILE);
        const rental = rentals.find(r => r.id === rentalId);
        
        if (!rental || rental.status !== 'invoiced') {
            return res.status(404).json({ error: 'Rental not found or not in invoiced state.' });
        }

        rental.status = 'paid';

        // Make the assigned generator available again
        if (rental.generator_id) {
            const generator = generators.find(g => g.id === rental.generator_id);
            if (generator) {
                generator.is_available = true;
            }
        }
        
        await writeData(RENTALS_FILE, rentals);
        await writeData(GENERATORS_FILE, generators);
        
        res.json({ message: 'Payment recorded and generator released' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark as paid.' });
    }
});

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
        res.status(500).json({ error: 'Failed to toggle generator status.' });
    }
});

// [REMOVED] This endpoint is no longer needed in the rental workflow.
// The logic is now handled by the 'paid' status update.
/*
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
        res.status(500).json({ error: 'Failed to return generator.' });
    }
});
*/

// --- 8. SERVER STARTUP & DATA HELPERS ---
async function initializeData() {
    try { await fs.access(RENTALS_FILE); } catch { await fs.writeFile(RENTALS_FILE, JSON.stringify([])); }
    try { await fs.access(GENERATORS_FILE); } catch { const initialGenerators = [{ id: 1, name: "Aggregaatti 1", is_available: true, is_active: true }, { id: 2, name: "Aggregaatti 2", is_available: true, is_active: true }, { id: 3, name: "Aggregaatti 3", is_available: true, is_active: true }]; await fs.writeFile(GENERATORS_FILE, JSON.stringify(initialGenerators)); }
}

async function readData(file) { const data = await fs.readFile(file, 'utf-8'); return JSON.parse(data); }
async function writeData(file, data) { await fs.writeFile(file, JSON.stringify(data, null, 2)); }

initializeData().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('FATAL: Failed to initialize data files. Server not started.', err);
    process.exit(1);
});