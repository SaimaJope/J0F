// JobFuture Aggregator Rental - Clean, functional JavaScript
// Following the Nordic principle: nothing unnecessary, everything purposeful

// State management - Single source of truth
const state = {
    selectedStartDate: null,
    selectedEndDate: null,
    currentMonth: new Date(),
    pricePerDay: 95, // EUR, final price per day including 25.5% VAT
    bookedPeriods: [], // To store {start, end} objects
    activeGenerators: 0 // To store the number of active generators
};

// Seuraa, onko lomaketta parhaillaan lähettämässä. Estää tuplaklikkaukset.
let isSubmitting = false;

// API Configuration
const API_BASE = window.location.origin;

// DOM Elements - Cached for performance
const elements = {
    calendar: document.getElementById('calendar'),
    currentMonth: document.getElementById('currentMonth'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    priceEstimate: document.getElementById('priceEstimate'),
    addressGroup: document.getElementById('addressGroup'),
    rentalForm: document.getElementById('rentalForm'),
    modal: document.getElementById('successModal'),
    mainImage: document.getElementById('mainImage'),
    heroSubtitle: document.querySelector('.hero-subtitle') // Cache hero subtitle
};

// Finnish month names and day abbreviations
const finnishMonths = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];
const finnishDays = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

// Helper function to parse 'd.M.yyyy'
function parseFinnishDate(dateStr) {
    const parts = dateStr.split('.');
    // Date constructor: new Date(year, monthIndex, day)
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Fetch booked dates and active generators from the backend
async function fetchData() {
    try {
        const response = await fetch(`${API_BASE}/api/rentals/booked-dates`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        
        state.bookedPeriods = data.bookedPeriods.map(p => ({
            start: parseFinnishDate(p.start),
            end: parseFinnishDate(p.end)
        }));
        state.activeGenerators = data.activeGenerators;

    } catch (error) {
        console.error('Error fetching data:', error);
        state.activeGenerators = 0; // Fail-safe
    }
}

// Update the UI based on generator availability
function updateAvailabilityDisplay() {
    const submitButton = elements.rentalForm.querySelector('button[type="submit"]');
    
    if (state.activeGenerators > 0) {
        elements.heroSubtitle.innerHTML = `Vuokraa laadukas dieselaggregaatti työmaallesi. Toimitus tai nouto Leppävirralta.`;
        submitButton.disabled = false;
        submitButton.querySelector('.btn-text').textContent = 'Lähetä varauspyyntö';
    } else {
        elements.heroSubtitle.innerHTML = `Vuokraa laadukas dieselaggregaatti työmaallesi. Toimitus tai nouto Leppävirralta.<br>
        <strong style="color: #ff4444; margin-top: 10px; display: inline-block;">Kaikki aggregaatit ovat tällä hetkellä varattuja.</strong>`;
        submitButton.disabled = true;
        submitButton.querySelector('.btn-text').textContent = 'Ei saatavilla';
    }
}

// Calendar functionality
function initializeCalendar() {
    renderCalendar();
    
    elements.prevMonth.addEventListener('click', () => {
        state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
        renderCalendar();
    });
    
    elements.nextMonth.addEventListener('click', () => {
        state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
        renderCalendar();
    });
}

// Renders the calendar, disabling days if they are fully booked
function renderCalendar() {
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    elements.currentMonth.textContent = `${finnishMonths[month]} ${year}`;
    elements.calendar.innerHTML = '';

    finnishDays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        elements.calendar.appendChild(dayHeader);
    });

    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    let startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    for (let i = 0; i < startingDayOfWeek; i++) {
        elements.calendar.appendChild(document.createElement('div'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= totalDays; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const currentDate = new Date(year, month, day);
        
        const bookingsOnThisDay = state.bookedPeriods.filter(period => 
            currentDate >= period.start && currentDate <= period.end
        ).length;

        if (currentDate < today || bookingsOnThisDay >= state.activeGenerators) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.dataset.timestamp = currentDate.getTime();
            dayElement.addEventListener('click', handleDayClick);
            
            if (isDateSelected(currentDate)) {
                dayElement.classList.add('selected');
            } else if (isDateInRange(currentDate)) {
                dayElement.classList.add('in-range');
            }
        }
        elements.calendar.appendChild(dayElement);
    }
}

function handleDayClick(event) {
    const timestamp = parseInt(event.currentTarget.dataset.timestamp, 10);
    if (!timestamp) return;
    selectDate(new Date(timestamp));
}

function selectDate(date) {
    if (!date) return;
    if (!state.selectedStartDate || (state.selectedStartDate && state.selectedEndDate)) {
        state.selectedStartDate = new Date(date);
        state.selectedEndDate = null;
    } else {
        if (date < state.selectedStartDate) {
            state.selectedEndDate = new Date(state.selectedStartDate);
            state.selectedStartDate = new Date(date);
        } else {
            state.selectedEndDate = new Date(date);
        }
    }
    updateDateInputs();
    updatePrice();
    renderCalendar();
}

function isDateSelected(date) {
    return (state.selectedStartDate && date.getTime() === state.selectedStartDate.getTime()) ||
           (state.selectedEndDate && date.getTime() === state.selectedEndDate.getTime());
}

function isDateInRange(date) {
    if (!state.selectedStartDate || !state.selectedEndDate) return false;
    return date > state.selectedStartDate && date < state.selectedEndDate;
}

function updateDateInputs() {
    elements.startDate.value = state.selectedStartDate ? formatDate(state.selectedStartDate) : '';
    elements.endDate.value = state.selectedEndDate ? formatDate(state.selectedEndDate) : '';
}

function formatDate(date) {
    return date.toLocaleDateString('fi-FI');
}

function updatePrice() {
    if (!state.selectedStartDate || !state.selectedEndDate) {
        elements.priceEstimate.textContent = '0€';
        return;
    }
    const days = Math.max(1, Math.ceil((state.selectedEndDate - state.selectedStartDate) / (1000 * 60 * 60 * 24)) + 1);
    const finalPrice = days * state.pricePerDay;
    elements.priceEstimate.textContent = `${finalPrice}€`;
}

// Gallery functionality
function initializeGallery() {
    const thumbs = document.querySelectorAll('.thumb');
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', function() {
            elements.mainImage.src = this.getAttribute('data-full');
            thumbs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Form functionality
function initializeForm() {
    document.querySelectorAll('input[name="delivery"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const isDelivery = this.value === 'delivery';
            elements.addressGroup.style.display = isDelivery ? 'block' : 'none';
            document.getElementById('address').required = isDelivery;
        });
    });
    elements.rentalForm.addEventListener('submit', handleFormSubmit);
}


async function handleFormSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return; // Estää tuplaklikkaukset

    // Tarkista päivämäärät ensin
    if (!state.selectedStartDate || !state.selectedEndDate) {
        document.getElementById('dateErrorModal').classList.add('active');
        return;
    }

    isSubmitting = true; // Lukitaan lähetys
    const submitButton = e.target.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.btn-text');
    
    // --- VAIHE 1: ALOITA PROSESSOINTI-ILME ---
    submitButton.classList.add('loading'); // Lisää latausluokka (näyttää spinnerin)
    submitButton.disabled = true;

    // --- VAIHE 2: DYNAAMINEN TEKSTIPALAUTE ---
    // Muutetaan napin tekstiä vaiheittain, jotta tuntuu, että jotain tapahtuu.
    setTimeout(() => { buttonText.textContent = 'Tarkistetaan tietoja...'; }, 0);
    setTimeout(() => { buttonText.textContent = 'Vahvistetaan saatavuutta...'; }, 1200);
    setTimeout(() => { buttonText.textContent = 'Lähetetään pyyntöä...'; }, 2400);

    // --- VAIHE 3: GARANTEERATTU MINIMIVIIVE ---
    // Määritellään kaksi erillistä lupausta (Promise):
    // 1. Todellinen verkkopyyntö palvelimelle.
    // 2. Keinotekoinen viive, joka kestää vähintään 3.5 sekuntia.
    
    const formData = new FormData(e.target);
    const data = {
        startDate: formatDate(state.selectedStartDate),
        endDate: formatDate(state.selectedEndDate),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        delivery: formData.get('delivery'),
        address: formData.get('address') || '',
        price: parseFloat(elements.priceEstimate.textContent)
    };

    const networkPromise = fetch(`${API_BASE}/api/rentals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const delayPromise = new Promise(resolve => setTimeout(resolve, 3500));

    try {
        // Promise.all odottaa, että SEKÄ verkkopyyntö on valmis ETTÄ minimiaika on kulunut.
        const [response] = await Promise.all([networkPromise, delayPromise]);

        if (!response.ok) {
            // Jos verkkopyyntö epäonnistui, heitetään virhe.
            throw new Error('Booking submission failed');
        }
        
        // Kaikki meni hyvin! Näytetään onnistumisikkuna.
        showSuccessModal();
        resetForm();
        await fetchData();
        renderCalendar();

    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Pyyntö epäonnistui. Tarkista tiedot ja yritä uudelleen.');
    } finally {
        // --- LOPUKSI: PALAUTA NAPPI NORMAALIKSI ---
        // Tämä suoritetaan aina, onnistui lähetys tai ei.
        isSubmitting = false; // Vapautetaan lukko
        submitButton.classList.remove('loading'); // Poistaa latausluokan (piilottaa spinnerin)
        submitButton.disabled = false;
        // Palautetaan napin tila saatavuuden mukaan
        updateAvailabilityDisplay();
    }
}

function showSuccessModal() {
    elements.modal.classList.add('active');
}

function closeModal() {
    // Tämä hakee KAIKKI aktiiviset modaalit ja poistaa niiltä 'active'-luokan.
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

function resetForm() {
    elements.rentalForm.reset();
    state.selectedStartDate = null;
    state.selectedEndDate = null;
    updateDateInputs();
    updatePrice();
    elements.addressGroup.style.display = 'none';
}

// Global functions for modal handling
window.closeModal = closeModal;
window.showTermsModal = (e) => {
    e.preventDefault();
    document.getElementById('termsModal').classList.add('active');
};
window.closeTermsModal = () => {
    document.getElementById('termsModal').classList.remove('active');
};

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    initializeGallery();
    initializeForm();
    await fetchData();
    updateAvailabilityDisplay();
    initializeCalendar();
});