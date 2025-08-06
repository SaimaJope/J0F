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
const nodemailer = require('nodemailer'); // LISÄTTY: Kirjasto sähköpostien lähetykseen

// --- 2. INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 3. PATH DEFINITIONS ---
const publicPath = path.join(__dirname, 'public');
const viewsPath = path.join(__dirname, 'views');
const RENTALS_FILE = path.join(__dirname, 'rentals.json');
const GENERATORS_FILE = path.join(__dirname, 'generators.json');

// --- 4. CORE MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));

// --- 5. SESSION AUTHENTICATION SETUP ---
app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-default-secret-for-local-testing',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// --- 6. SECURITY GATEKEEPER MIDDLEWARE ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};


// =================================================================
// SÄHKÖPOSTIN ASETUKSET - UUSI OSA
// =================================================================

// Määritetään sähköpostin lähetyspalvelu (transporter).
// Tiedot haetaan Renderiin tallennetuista ympäristömuuttujista.
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,       // Esim. 'smtp-relay.brevo.com'
    port: process.env.EMAIL_PORT || 587,
    secure: false, // Arvo on 'false', koska käytämme porttia 587 (TLS)
    auth: {
        user: process.env.EMAIL_USER,   // Sähköpostipalvelun käyttäjätunnus (esim. Brevo-sähköposti)
        pass: process.env.EMAIL_PASS,   // Sähköpostipalvelusta saatu API-AVAIN (ei sähköpostin salasana)
    },
});

// Funktio, joka rakentaa ja lähettää sähköposti-ilmoituksen.
async function sendNewRentalNotification(rentalDetails) {
    try {
        const mailOptions = {
            from: `"JobFuture Varausjärjestelmä" <${process.env.EMAIL_USER}>`, // Lähettäjän nimi ja osoite
            to: 'info@jobfuture.fi', // <<-- 
            subject: `Uusi varauspyyntö: ${rentalDetails.name}`, // Sähköpostin otsikko
            
            // Sähköpostin tekstiversio (asiakkaille, joiden sähköposti ei näytä HTML:ää)
            text: `
                Uusi varauspyyntö on saapunut!

                Asiakas: ${rentalDetails.name}
                Sähköposti: ${rentalDetails.email}
                Puhelin: ${rentalDetails.phone}
                
                Ajankohta: ${rentalDetails.start_date} - ${rentalDetails.end_date}
                Toimitus: ${rentalDetails.delivery_type === 'delivery' ? 'Toimitus' : 'Nouto'}
                Osoite: ${rentalDetails.address || 'Ei määritelty'}
                
                Hinta-arvio: ${rentalDetails.price} €
                
               Jos toimitus, lisää 3€/km hintaan!!!
            `,
            
            // Sähköpostin HTML-versio (paremman näköinen)
            html: `
                <h3>Uusi varauspyyntö on saapunut!</h3>
                <p><strong>Asiakas:</strong> ${rentalDetails.name}</p>
                <p><strong>Sähköposti:</strong> ${rentalDetails.email}</p>
                <p><strong>Puhelin:</strong> ${rentalDetails.phone}</p>
                <hr>
                <p><strong>Ajankohta:</strong> ${rentalDetails.start_date} - ${rentalDetails.end_date}</p>
                <p><strong>Toimitustapa:</strong> ${rentalDetails.delivery_type === 'delivery' ? 'Toimitus' : 'Nouto'}</p>
                <p><strong>Toimitusosoite:</strong> ${rentalDetails.address || 'Nouto Leppävirralta'}</p>
                <p><strong>Hinta-arvio:</strong> ${rentalDetails.price} €</p>
                <hr>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Sähköposti-ilmoitus uudesta varauksesta lähetetty onnistuneesti.');

    } catch (error) {
        // Jos sähköpostin lähetys epäonnistuu, tulostetaan virhe palvelimen lokiin,
        // mutta sovellus ei kaadu.
        console.error('Sähköposti-ilmoituksen lähettäminen epäonnistui:', error);
    }
}


// =================================================================
// --- 7. ROUTE HANDLERS ---
// =================================================================

// PAGE SERVING ROUTES
app.get('/login', (req, res) => res.sendFile(path.join(viewsPath, 'login.html')));
app.get('/admin', isAuthenticated, (req, res) => res.sendFile(path.join(viewsPath, 'admin.html')));

// AUTHENTICATION API ROUTES
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password';
    if (username === adminUser && password === adminPass) {
        req.session.user = { username };
        res.redirect('/admin');
    } else {
        res.redirect('/login?error=true');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.redirect('/admin'); }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// PUBLIC API ROUTES

// TÄMÄ REitti on MUOKATTU sisältämään sähköpostin lähetyksen
app.post('/api/rentals', async (req, res) => {
    try {
        const { name, email, phone, startDate, endDate, delivery, address, price } = req.body;
        const rentals = await readData(RENTALS_FILE);
        const newRental = { id: Date.now(), name, email, phone, start_date: startDate, end_date: endDate, delivery_type: delivery, address: address || '', price: parseFloat(price), status: 'pending', created_at: new Date().toISOString(), generator_id: null };
        rentals.push(newRental);
        await writeData(RENTALS_FILE, rentals);

        // KUTSUTAAN SÄHKÖPOSTIFUNKTIOTA, kun uusi varaus on tallennettu.
        // Funktio suoritetaan taustalla, eikä se hidasta käyttäjälle annettavaa vastausta.
        sendNewRentalNotification(newRental);

        res.status(201).json({ id: newRental.id, message: 'Rental request created successfully' });
    } catch (err) {
        console.error('Virhe varauspyynnön luomisessa:', err);
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

app.get('/api/rentals/booked-dates', async (req, res) => {
    try {
        const rentals = await readData(RENTALS_FILE);
        const activeGeneratorsCount = (await readData(GENERATORS_FILE)).filter(g => g.is_active).length;
        const confirmedRentals = rentals.filter(r => ['approved', 'invoiced'].includes(r.status));
        const bookedPeriods = confirmedRentals.map(r => ({ start: r.start_date, end: r.end_date }));
        res.json({ bookedPeriods, activeGenerators: activeGeneratorsCount });
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