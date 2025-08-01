// JobFuture Aggregator Rental - Clean, functional JavaScript
// Following the Nordic principle: nothing unnecessary, everything purposeful

// State management - Single source of truth
const state = {
    selectedStartDate: null,
    selectedEndDate: null,
    currentMonth: new Date(),
    pricePerDay: 95, // EUR, final price per day including 25.5% VAT
    availableGenerators: 3
};

// API Configuration
const API_BASE = window.location.origin; // Works for both local and production

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
    mainImage: document.getElementById('mainImage')
};

// Finnish month names - Respecting locale
const finnishMonths = [
    'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu',
    'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu',
    'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'
];

// Finnish day abbreviations
const finnishDays = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initializeCalendar();
    initializeGallery();
    initializeForm();
    checkAvailability(); // Check generator availability on load
});

// Check generator availability
async function checkAvailability() {
    try {
        const response = await fetch(`${API_BASE}/api/generators/availability`);
        const data = await response.json();
        
        state.availableGenerators = data.available;
        updateAvailabilityDisplay();
    } catch (error) {
        console.error('Error checking availability:', error);
    }
}

function updateAvailabilityDisplay() {
    // Add availability info to the hero section
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) {
        const availabilityText = state.availableGenerators > 0 
            ? `${state.availableGenerators}/3 aggregaattia saatavilla`
            : 'Kaikki aggregaatit varattu';
        
        heroSubtitle.innerHTML = `Vuokraa laadukas dieselaggregaatti työmaallesi. Toimitus tai nouto Leppävirralta.<br>
        <strong style="color: ${state.availableGenerators > 0 ? '#FFB800' : '#ff4444'}">${availabilityText}</strong>`;
    }
    
    // Disable form if no generators available
    const submitButton = elements.rentalForm.querySelector('button[type="submit"]');
    if (state.availableGenerators === 0) {
        submitButton.disabled = true;
        submitButton.textContent = 'Ei saatavilla';
    } else {
        submitButton.disabled = false;
        submitButton.textContent = 'Lähetä varauspyyntö';
    }
}

// Calendar functionality - The heart of the booking system
function initializeCalendar() {
    renderCalendar();
    
    // Navigation
    elements.prevMonth.addEventListener('click', () => {
        state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
        renderCalendar();
    });
    
    elements.nextMonth.addEventListener('click', () => {
        state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
        renderCalendar();
    });
}

function renderCalendar() {
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    
    // Update header
    elements.currentMonth.textContent = `${finnishMonths[month]} ${year}`;
    
    // Clear calendar
    elements.calendar.innerHTML = '';
    
    // Add day headers
    finnishDays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        elements.calendar.appendChild(dayHeader);
    });
    
    // Calculate first day and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    
    // Adjust for Monday start (Finnish convention)
    let startingDayOfWeek = firstDay.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;
    
    // Add empty cells for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        elements.calendar.appendChild(emptyDay);
    }
    
    // Add days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= totalDays; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        // Use innerHTML to ensure text persists
        dayElement.innerHTML = day;
        
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);
        
        // Store date as timestamp to avoid closure issues
        dayElement.dataset.timestamp = currentDate.getTime();
        dayElement.dataset.day = day;  // Store day number as backup
        
        // Disable past dates
        if (currentDate < today) {
            dayElement.classList.add('disabled');
        } else {
            // Use event delegation approach
            dayElement.addEventListener('click', handleDayClick);
            
            // Highlight selected dates
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
    const element = event.currentTarget;
    const timestamp = parseInt(element.dataset.timestamp);
    
    if (!timestamp) return;
    
    const date = new Date(timestamp);
    selectDate(date);
}

function selectDate(date) {
    if (!date) return;
    
    if (!state.selectedStartDate || (state.selectedStartDate && state.selectedEndDate)) {
        // First selection or restart
        state.selectedStartDate = new Date(date);
        state.selectedEndDate = null;
    } else {
        // Second selection
        if (date < state.selectedStartDate) {
            // If earlier date selected, swap
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
    if (state.selectedStartDate) {
        elements.startDate.value = formatDate(state.selectedStartDate);
    } else {
        elements.startDate.value = '';
    }
    
    if (state.selectedEndDate) {
        elements.endDate.value = formatDate(state.selectedEndDate);
    } else {
        elements.endDate.value = '';
    }
}

function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function updatePrice() {
    if (!state.selectedStartDate || !state.selectedEndDate) {
        elements.priceEstimate.textContent = '0€';
        return;
    }
    
    const days = Math.ceil((state.selectedEndDate - state.selectedStartDate) / (1000 * 60 * 60 * 24));
    const finalPrice = days * state.pricePerDay;
    elements.priceEstimate.textContent = `${finalPrice}€`;
}

// Gallery functionality - Simple, effective
function initializeGallery() {
    const thumbs = document.querySelectorAll('.thumb');
    
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', function() {
            // Update main image
            const fullImage = this.getAttribute('data-full');
            elements.mainImage.src = fullImage;
            
            // Update active state
            thumbs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Form functionality - User-centric validation
function initializeForm() {
    // Delivery option toggle
    const deliveryRadios = document.querySelectorAll('input[name="delivery"]');
    deliveryRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'delivery') {
                elements.addressGroup.style.display = 'block';
                document.getElementById('address').required = true;
            } else {
                elements.addressGroup.style.display = 'none';
                document.getElementById('address').required = false;
            }
        });
    });
    
    // Form submission
    elements.rentalForm.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate dates
    if (!state.selectedStartDate || !state.selectedEndDate) {
        alert('Valitse vuokrausajankohta kalenterista.');
        return;
    }
    
    // Check availability one more time
    if (state.availableGenerators === 0) {
        alert('Valitettavasti kaikki aggregaatit ovat varattuja.');
        return;
    }
    
    // Collect form data
    const formData = new FormData(e.target);
    const data = {
        startDate: formatDate(state.selectedStartDate),
        endDate: formatDate(state.selectedEndDate),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        delivery: formData.get('delivery'),
        address: formData.get('address') || '',
        price: parseFloat(elements.priceEstimate.textContent.replace('€', ''))
    };
    
    // Disable submit button to prevent double submission
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Lähetetään...';
    
    try {
        const response = await fetch(`${API_BASE}/api/rentals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const result = await response.json();
        console.log('Booking created:', result);
        
        showSuccessModal();
        resetForm();
        checkAvailability(); // Refresh availability
        
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('Virhe lomakkeen lähetyksessä. Yritä uudelleen.');
    } finally {
        submitButton.disabled = false;
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
    renderCalendar();
    elements.addressGroup.style.display = 'none';
}

// Global functions for modal handling
window.closeModal = closeModal;
window.showTermsModal = showTermsModal;
window.closeTermsModal = closeTermsModal;

function showTermsModal(e) {
    e.preventDefault();
    document.getElementById('termsModal').classList.add('active');
}

function closeTermsModal() {
    document.getElementById('termsModal').classList.remove('active');
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add subtle animations on scroll (optional enhancement)
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for subtle fade-in
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});