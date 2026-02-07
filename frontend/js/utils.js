/* ===================================
   EXPENSE TRACKER - Utility Functions
   =================================== */

// ===================================
// Date Utilities
// ===================================

/**
 * Format date to display string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Format date for input fields
 */
function formatDateForInput(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

/**
 * Get relative date string
 */
function getRelativeDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
        return 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Yesterday';
    } else {
        return formatDate(dateString);
    }
}

/**
 * Get date X days ago
 */
function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDateForInput(date);
}

/**
 * Convert Gregorian to Ethiopian date (simplified)
 */
function toEthiopianDate(gregorianDate) {
    if (window.i18n && window.i18n.toEthiopianDate) {
        return window.i18n.toEthiopianDate(gregorianDate);
    }

    // Fallback if i18n not loaded
    const date = new Date(gregorianDate);
    const months = [
        'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
        'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
    ];

    let ethiopianYear = date.getFullYear() - 8;
    if (date.getMonth() < 8) ethiopianYear--;

    const monthIndex = (date.getMonth() + 4) % 13;
    const day = date.getDate();

    return `${months[monthIndex]} ${day}, ${ethiopianYear}`;
}

// ===================================
// Currency Utilities
// ===================================

/**
 * Format currency (ETB)
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Parse currency string to number
 */
function parseCurrency(currencyString) {
    return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
}

// ===================================
// Search Utilities
// ===================================

/**
 * Fuzzy search implementation
 */
function fuzzySearch(query, items, key = null) {
    if (!query) return items;

    const searchTerm = query.toLowerCase().trim();

    return items.filter(item => {
        const value = key ? item[key] : item;
        const text = value.toLowerCase();

        // Exact match
        if (text.includes(searchTerm)) return true;

        // Fuzzy match - check if all characters exist in order
        let searchIndex = 0;
        for (let i = 0; i < text.length && searchIndex < searchTerm.length; i++) {
            if (text[i] === searchTerm[searchIndex]) {
                searchIndex++;
            }
        }
        return searchIndex === searchTerm.length;
    });
}

/**
 * Highlight matched text
 */
function highlightMatch(text, query) {
    if (!query) return text;

    const searchTerm = query.toLowerCase();
    const textLower = text.toLowerCase();
    const startIndex = textLower.indexOf(searchTerm);

    if (startIndex === -1) return text;

    const before = text.substring(0, startIndex);
    const match = text.substring(startIndex, startIndex + searchTerm.length);
    const after = text.substring(startIndex + searchTerm.length);

    return `${before}<mark>${match}</mark>${after}`;
}

// ===================================
// Storage Utilities
// ===================================

/**
 * Save to localStorage
 */
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to storage:', error);
        return false;
    }
}

/**
 * Load from localStorage
 */
function loadFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Error loading from storage:', error);
        return defaultValue;
    }
}

/**
 * Remove from localStorage
 */
function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from storage:', error);
        return false;
    }
}

// ===================================
// DOM Utilities
// ===================================

/**
 * Select element
 */
function $(selector) {
    return document.querySelector(selector);
}

/**
 * Select all elements
 */
function $$(selector) {
    return document.querySelectorAll(selector);
}

/**
 * Create element with attributes
 */
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key.startsWith('data')) {
            element.dataset[key.replace('data', '').toLowerCase()] = value;
        } else if (key.startsWith('on')) {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });

    return element;
}

// ===================================
// Toast Notification
// ===================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = $('#toast');
    const toastMessage = toast.querySelector('.toast-message');

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    // Remove all type classes and add the current one
    toast.classList.remove('success', 'error', 'warning', 'info', 'hidden');
    toast.classList.add(type);

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
}

// ===================================
// Modal Utilities
// ===================================

/**
 * Show modal
 */
function showModal(idOrElement) {
    if (typeof idOrElement === 'string') {
        // Handle existing modal by ID
        const modal = $(`#${idOrElement}`);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    } else if (idOrElement instanceof Element) {
        // Handle dynamic content
        let modal = $('#dynamic-modal');

        // Create generic modal if not exists
        if (!modal) {
            modal = createElement('div', { className: 'modal hidden', id: 'dynamic-modal' }, [
                createElement('div', { className: 'modal-backdrop', id: 'dynamic-modal-backdrop', onclick: () => hideModal('dynamic-modal') }),
                createElement('div', { className: 'modal-content', id: 'dynamic-modal-content' })
            ]);
            document.body.appendChild(modal);
        }

        const container = modal.querySelector('#dynamic-modal-content');
        if (container) {
            container.innerHTML = ''; // Clear previous
            container.appendChild(idOrElement);
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }
}

/**
 * Hide modal
 */
function hideModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// ===================================
// Validation Utilities
// ===================================

/**
 * Validate phone number (Ethiopian format)
 */
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    // Ethiopian phone: starts with 251 or 09, 10-12 digits
    return /^(251|0)?9\d{8}$/.test(cleaned);
}

/**
 * Validate password strength
 */
function getPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 3) return 'medium';
    return 'strong';
}

// ===================================
// ID Generation
// ===================================

/**
 * Generate unique ID
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===================================
// Array Utilities
// ===================================

/**
 * Group array by key
 */
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}

/**
 * Sort array by key
 */
function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const valueA = typeof key === 'function' ? key(a) : a[key];
        const valueB = typeof key === 'function' ? key(b) : b[key];

        if (order === 'desc') {
            return valueB > valueA ? 1 : valueB < valueA ? -1 : 0;
        }
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
    });
}

// ===================================
// Debounce & Throttle
// ===================================

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ===================================
// Network Utilities
// ===================================

/**
 * Check online status
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Add offline/online listeners
 */
function addNetworkListeners(onOnline, onOffline) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
}

// ===================================
// Greeting Utility
// ===================================

/**
 * Get time-based greeting
 */
function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
}

/**
 * Get week number of year
 */
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

/**
 * Get initials from name
 */
function getInitials(name) {
    if (!name) return '??';
    const names = name.split(' ');
    const initials = names.map(n => n.charAt(0).toUpperCase()).join('').slice(0, 2);
    return initials;
}

// ===================================
// Export utilities
// ===================================
window.utils = {
    formatDate,
    formatDateForInput,
    getRelativeDate,
    getDateDaysAgo,
    toEthiopianDate,
    formatCurrency,
    parseCurrency,
    fuzzySearch,
    highlightMatch,
    saveToStorage,
    loadFromStorage,
    removeFromStorage,
    $,
    $$,
    createElement,
    showToast,
    showModal,
    hideModal,
    validatePhone,
    getPasswordStrength,
    generateId,
    groupBy,
    sortBy,
    debounce,
    throttle,
    isOnline,
    addNetworkListeners,
    getGreeting,
    getWeekNumber,
    getInitials
};
