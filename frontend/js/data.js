/* ===================================
   EXPENSE TRACKER - Static Data
   =================================== */

// Sample User Data
const userData = {
    id: 'user_001',
    username: 'Mezgeb',
    phone: '+251 912 345 678',
    email: 'mezgeb@example.com',
    profileImage: 'https://ui-avatars.com/api/?name=Mezgeb&background=333&color=fff&size=100',
    biometricEnabled: true,
    createdAt: '2025-01-15'
};

// Sample Categories
// Sample Categories
const categories = [];

// Sample Expenses
const expenses = [];

// Previous Reasons (for autocomplete)
const previousReasons = [];

// Available Icons for Categories
const availableIcons = [
    '🏠', '🏪', '🏢', '🚗', '🍔', '💊', '📚', '👔', '🎮', '✈️',
    '🏥', '🎓', '💡', '📱', '🛒', '🎬', '⚽', '🎵', '💄', '🐕',
    '🏋️', '☕', '🍕', '🎁', '💻', '📺', '🎨', '🔧', '🌿', '🏦',
    '💳', '🎭', '🚌', '⛽', '🧹', '👶', '💈', '🍺', '🏊', '🎿',
    '📷', '🎸', '🎯', '🎲', '🚿', '💎', '🎪', '🏕️', '🎠', '🛍️'
];

// Chart Data - Weekly
const weeklyChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    positive: [2500, 1800, 3200, 2100, 4500, 1200, 3000],
    negative: [500, 300, 800, 400, 600, 200, 350]
};

// Chart Data - Monthly
const monthlyChartData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    positive: [12500, 15800, 11200, 14100],
    negative: [2500, 1800, 3200, 2100]
};

// Chart Data - Yearly
const yearlyChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    positive: [45000, 52000, 48000, 55000, 62000, 58000, 51000, 49000, 53000, 47000, 56000, 45750],
    negative: [8000, 6500, 7200, 9000, 8500, 7800, 6900, 7500, 8200, 7100, 9500, 8000]
};

// User Settings
const userSettings = {
    darkMode: false,
    fontSize: 'medium', // small, medium, large
    budgetLimit: 10000,
    budgetAlertEnabled: true,
    reminderSchedule: 'weekly', // daily, weekly, monthly, custom
    reminderTime: '09:00',
    notificationsEnabled: true
};

// Ethiopian Months
const ethiopianMonths = [
    'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
    'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

// Ethiopian Days
const ethiopianDays = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];

// Export all data
window.appData = {
    userData,
    categories,
    expenses,
    previousReasons,
    availableIcons,
    weeklyChartData,
    monthlyChartData,
    yearlyChartData,
    userSettings,
    ethiopianMonths,
    ethiopianDays
};
