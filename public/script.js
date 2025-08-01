// JobFuture Aggregator Rental - Clean, functional JavaScript
// Following the Nordic principle: nothing unnecessary, everything purposeful

// State management - Single source of truth
const state = {
    selectedStartDate: null,
    selectedEndDate: null,
    currentMonth: new Date(),
    pricePerDay: 95, // EUR, final price per day including 25.5% VAT
    availableGenerators: 0 // Initialize to 0, will be updated from API
};

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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    initializeGallery();
    initializeForm();
    await checkAvailability(); // Wait for availability check to complete
    initializeCalendar(); // Then initialize calendar which depends on availability
});

// Check generator availability from the backend
async function checkAvailability() {
    try {
        const response = await fetch(`${API_BASE}/api/generators/availability`);
        if (!response.ok) throw new Error('Failed to fetch availability');
        const data = await response.json();
        
        state.availableGenerators = data.available;
        updateAvailabilityDisplay();
    } catch (error) {
        console.error('Error checking availability:', error);
        // Fallback: assume not available to prevent incorrect bookings
        state.availableGenerators = 0;
        updateAvailabilityDisplay();
    }
}

// [MODIFIED] Update the UI based on generator availability
function updateAvailabilityDisplay() {
    const submitButton = elements.rentalForm.querySelector('button[type="submit"]');
    
    if (state.availableGenerators > 0) {
        // Generators are available, hide any special messages
        elements.heroSubtitle.innerHTML = `Vuokraa laadukas dieselaggregaatti työmaallesi. Toimitus tai nouto Leppävirralta.`;
        submitButton.disabled = false;
        submitButton.textContent = 'Lähetä varauspyyntö';
    } else {
        // No generators available, show message and disable form
        elements.heroSubtitle.innerHTML = `Vuokraa laadukas dieselaggregaatti työmaallesi. Toimitus tai nouto Leppävirralta.<br>
        <strong style="color: #ff4444; margin-top: 10px; display: inline-block;">Kaikki aggregaatit ovat tällä hetkellä varattuja.</strong>`;
        submitButton.disabled = true;
        submitButton.textContent = 'Ei saatavilla';
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

// [MODIFIED] Renders the calendar, disabling it if no generators are available
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

    const areGeneratorsAvailable = state.availableGenerators > 0;

    for (let day = 1; day <= totalDays; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const currentDate = new Date(year, month, day);
        
        // Disable past dates OR if no generators are available at all
        if (currentDate < today || !areGeneratorsAvailable) {
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
    const days = Math.max(1, Math.ceil((state.selectedEndDate - state.selectedStartDate) / (1000 * 60 * 60 * 24)));
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
    if (!state.selectedStartDate || !state.selectedEndDate) {
        alert('Valitse vuokrausajankohta kalenterista.');
        return;
    }
    
    // Final availability check before submission
    await checkAvailability();
    if (state.availableGenerators === 0) {
        alert('Valitettavasti kaikki aggregaatit ovat varattuja. Pyyntöä ei voi lähettää.');
        return;
    }

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
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Lähetetään...';
    
    try {
        const response = await fetch(`${API_BASE}/api/rentals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Booking submission failed');
        
        showSuccessModal();
        resetForm();
        await checkAvailability(); // Refresh availability and UI
        renderCalendar(); // Re-render calendar with potentially new disabled state
        
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Virhe lomakkeen lähetyksessä. Yritä uudelleen.');
    } finally {
        // Re-enable button only if generators are still available
        if(state.availableGenerators > 0) {
           submitButton.disabled = false;
        }
        submitButton.textContent = 'Lähetä varauspyyntö';
    }
}

function showSuccessModal() {
    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

function resetForm() {
    elements.rentalForm.reset();
    state.selectedStartDate = null;
    state.selectedEndDate = null;
    updateDateInputs();
    updatePrice();
    elements.addressGroup.style.display = 'none';
    // Calendar is reset via the main flow
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