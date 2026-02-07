/* ===================================
   EXPENSE TRACKER - Main Application
   =================================== */

// App State
const appState = {
    currentPage: 'login',
    isLoggedIn: false,
    selectedCategory: null,
    selectedExpenseId: null,
    selectedCategoryIcon: '🏠',
    selectedDate: 'today',
    filters: {
        search: '',
        dateFrom: null,
        dateTo: null,
        amountMin: null,
        amountMax: null
    },
    // Load context, handling "null" string bug
    currentGroupId: (function () {
        const saved = localStorage.getItem('currentGroupId');
        return (saved && saved !== 'null' && saved !== 'undefined') ? saved : null;
    })(),
    groups: [] // List of connected groups
};

// ===================================
// Initialization
// ===================================



function initCategoryPage() {
    // Period selector
    utils.$$('#category-page .period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            utils.$$('#category-page .period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCategoryChart(btn.dataset.period);
        });
    });
}

// ... (previous code)

function hideSplashScreen() {
    const splash = utils.$('#splash-screen');
    const app = utils.$('#app');

    // Immediate removal as requested
    splash.style.display = 'none';
    app.classList.remove('hidden');
}

// ===================================
// Navigation
// ===================================

function initNavigation() {
    // ... (keep as is)
    const navItems = utils.$$('.nav-item');
    const bottomNav = utils.$('#bottom-nav');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show page
            showPage(page);
        });
    });
}

function showPage(pageName, pushState = true) {
    // Auth Guard
    if (pageName !== 'login' && pageName !== 'register' && !appState.isLoggedIn) {
        console.warn('Redirecting to login: Not authenticated');
        pageName = 'login';
        pushState = false;
    }

    const pages = utils.$$('.page');
    const targetPage = utils.$(`#${pageName}-page`);
    const bottomNav = utils.$('#bottom-nav');

    // Hide all pages
    pages.forEach(page => page.classList.add('hidden'));

    // Show target page
    if (targetPage) {
        targetPage.classList.remove('hidden');
        appState.currentPage = pageName;

        // Handle browser history handling
        if (pushState && pageName !== 'login' && pageName !== 'register') {
            const state = { page: pageName };
            // Avoid duplicate pushes
            if (history.state?.page !== pageName) {
                history.pushState(state, '', `#${pageName}`);
            }
        }

        // Show/hide bottom nav based on page
        if (['login', 'register'].includes(pageName)) {
            bottomNav.classList.add('hidden');
        } else {
            bottomNav.classList.remove('hidden');
        }

        // Page-specific initializations
        if (pageName === 'home') {
            renderHome();
        } else if (pageName === 'report') {
            renderReport();
        } else if (pageName === 'settings') {
            renderSettings();
            setTimeout(renderGroupsSettings, 50); // Small delay to ensure DOM is ready
        } else if (pageName === 'add-expense') {
            renderAddExpense();
        }
    }

    // Update nav active state
    const navItems = utils.$$('.nav-item');
    navItems.forEach(nav => {
        if (nav.dataset.page === pageName) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    // Ensure all dynamic elements are translated
    if (window.i18n) {
        window.i18n.updatePage();
    }
}

// Handle Back Button
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
        showPage(event.state.page, false);
    } else {
        // Default fallback if no state
        showPage('home', false);
    }
});

// ===================================
// Authentication
// ===================================

function initAuth() {
    const loginForm = utils.$('#login-form');
    const registerForm = utils.$('#register-form');
    const gotoRegister = utils.$('#goto-register');
    const gotoLogin = utils.$('#goto-login');
    const togglePasswords = utils.$$('.toggle-password');

    // Toggle password visibility
    togglePasswords.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            const svg = btn.querySelector('svg');
            if (svg) svg.style.opacity = type === 'password' ? '0.5' : '1';
        });
    });

    // Login form submission
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const phone = utils.$('#login-phone').value;
        const password = utils.$('#login-password').value;

        if (phone && password) {
            handleLogin({ phone, password });
        }
    });

    // Register form submission
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = utils.$('#register-username').value;
        const phone = utils.$('#register-phone').value;
        const password = utils.$('#register-password').value;

        if (username && phone && password) {
            handleRegister({ username, phone, password });
        }
    });

    // Navigation
    gotoRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('register');
    });

    gotoLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('login');
    });

    // Auto-fill phone number if saved
    const savedPhone = utils.loadFromStorage('savedPhone');
    if (savedPhone) {
        utils.$('#login-phone').value = savedPhone;
    }
}

async function handleLogin(credentials) {
    try {
        const btn = utils.$('#login-form button[type="submit"]');
        if (btn) btn.disabled = true;

        utils.showToast(navigator.onLine ? 'Signing in...' : 'Signing in offline...', 'info');

        let user;
        try {
            if (navigator.onLine) {
                await api.login(credentials);
            } else {
                await api.loginOffline(credentials);
            }
        } catch (authError) {
            // If online login failed due to network, try offline
            if (authError.message.includes('network') || !navigator.onLine) {
                await api.loginOffline(credentials);
            } else {
                throw authError; // Re-throw valid errors (wrong pass on server)
            }
        }

        // Save phone for autofill
        utils.saveToStorage('savedPhone', credentials.phone);

        appState.isLoggedIn = true;
        utils.showToast('Welcome back!', 'success');

        await initGroups(); // Load shared groups

        showPage('home');
    } catch (e) {
        console.error(e);
        utils.showToast(e.message || 'Login failed.', 'error');
    } finally {
        const btn = utils.$('#login-form button[type="submit"]');
        if (btn) btn.disabled = false;
    }
}

// verifyBiometric removed

async function handleRegister(data) {
    try {
        utils.showToast('Creating account...', 'info');
        await api.register(data);
        appState.isLoggedIn = true;
        utils.showToast('Account created successfully!', 'success');
        await initGroups();
        showPage('home');
    } catch (e) {
        utils.showToast(e.message, 'error');
    }
}

// Biometric functions removed

function handleLogout() {
    appState.isLoggedIn = false;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    utils.showToast('Logged out successfully', 'info');
    showPage('login');
}

// ===================================
// Home Page
// ===================================

function initHome() {
    const gotoReport = utils.$('#goto-report');
    const profileBtn = utils.$('#profile-btn');
    const notificationBell = utils.$('.notification-bell');

    gotoReport.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('report');
    });

    profileBtn.addEventListener('click', () => {
        showPage('settings');
    });

    // Notification bell
    if (notificationBell) {
        notificationBell.addEventListener('click', () => {
            // Re-generate notifications to ensure freshness
            generateNotificationsFromExpenses(window.appData.expenses || [], window.appData.categories || []);

            // Show notifications dropdown
            showNotificationDropdown();
        });
    }

    // Period selector
    utils.$$('#home-page .period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            utils.$$('#home-page .period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                const expenses = await api.getExpenses();
                updateHomeChartWithData(expenses, btn.dataset.period);
            } catch (e) {
                utils.showToast('Failed to update chart', 'error');
            }
        });
    });

    // Swipe handling for context
    const swipeContainer = utils.$('#home-context-container');
    if (swipeContainer) {
        swipeContainer.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        swipeContainer.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });
    }
}

async function renderHome() {
    try {
        utils.$('.greeting').textContent = utils.getGreeting();
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            utils.$('.username').textContent = currentUser.username;
            const avatarImg = utils.$('.profile-avatar img');
            if (avatarImg && currentUser.profileImage) {
                avatarImg.src = currentUser.profileImage;
            }
        }

        const categories = await api.getCategories(appState.currentGroupId);
        const expenses = await api.getExpenses({ groupId: appState.currentGroupId || undefined });

        window.appData = window.appData || {};
        window.appData.categories = categories;
        window.appData.expenses = expenses;

        // Calculations
        const now = new Date();
        const thisMonthExpenses = expenses.filter(exp => {
            const d = new Date(exp.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const thisMonthTotal = thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Lifetime Total
        const lifetimeTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Previous Month for Trend
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonthExpenses = expenses.filter(exp => {
            const d = new Date(exp.date);
            return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
        });
        const lastMonthTotal = lastMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        let percentChange = 0;
        if (lastMonthTotal > 0) {
            percentChange = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
        } else if (thisMonthTotal > 0) {
            percentChange = 100;
        }

        // DOM Updates with Visibility Logic
        const monthAmountEl = utils.$('#month-amount');
        const lifetimeAmountEl = utils.$('#lifetime-amount');

        const monthHtml = `${utils.formatCurrency(thisMonthTotal)} <span class="currency">ETB</span>`;
        const lifeHtml = `${utils.formatCurrency(lifetimeTotal)} <span class="currency">ETB</span>`;

        // Single Toggle Eye Logic for BOTH amounts with localStorage persistence
        const eyeBtn = utils.$('#toggle-expenses-eye');
        if (eyeBtn) {
            // Check localStorage for persisted hidden state
            const isHidden = localStorage.getItem('expenseAmountsHidden') === 'true';

            if (isHidden) {
                monthAmountEl.textContent = '****';
                lifetimeAmountEl.textContent = '****';
                monthAmountEl.dataset.hidden = 'true';
                lifetimeAmountEl.dataset.hidden = 'true';
                eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                monthAmountEl.innerHTML = monthHtml;
                lifetimeAmountEl.innerHTML = lifeHtml;
                monthAmountEl.dataset.hidden = 'false';
                lifetimeAmountEl.dataset.hidden = 'false';
                eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }

            eyeBtn.onclick = (e) => {
                e.stopPropagation();
                if (monthAmountEl.dataset.hidden === 'true') {
                    // Show values
                    monthAmountEl.innerHTML = monthHtml;
                    lifetimeAmountEl.innerHTML = lifeHtml;
                    monthAmountEl.dataset.hidden = 'false';
                    lifetimeAmountEl.dataset.hidden = 'false';
                    eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
                    localStorage.setItem('expenseAmountsHidden', 'false');
                } else {
                    // Hide values
                    monthAmountEl.textContent = '****';
                    lifetimeAmountEl.textContent = '****';
                    monthAmountEl.dataset.hidden = 'true';
                    lifetimeAmountEl.dataset.hidden = 'true';
                    eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    localStorage.setItem('expenseAmountsHidden', 'true');
                }
            };
        }

        const trendEl = utils.$('.expense-trend');
        const isUp = percentChange > 0;
        const trendClass = isUp ? 'trend-up' : 'trend-down';
        const arrow = isUp ? '↑' : '↓';
        trendEl.innerHTML = `
            <span class="trend-badge ${trendClass}">${arrow} ${Math.abs(percentChange).toFixed(1)}%</span>
            <span class="trend-text">this month vs last month</span>
        `;

        renderCategoriesData(categories, expenses);
        renderRecentExpensesData(expenses, categories);
        updateHomeChartWithData(expenses, 'weekly');
        generateNotificationsFromExpenses(expenses, categories);
    } catch (e) {
        console.error('Home render error:', e);
        utils.showToast('Failed to load home data', 'error');
    }
}

function renderCategoriesData(categories, expenses) {
    const container = utils.$('#categories-container');
    // Show all categories if none are explicitly visible (handles new DB scenario)
    let visibleCategories = categories.filter(cat => cat.isVisible);
    if (visibleCategories.length === 0) {
        visibleCategories = categories; // Fall back to all categories
    }

    container.innerHTML = '';

    // Empty State - No categories at all
    if (categories.length === 0) {
        const emptyCard = utils.createElement('div', {
            className: 'category-card',
            style: 'grid-column: span 2; text-align: center; padding: 30px;'
        }, [
            utils.createElement('p', {
                textContent: 'No categories yet.',
                style: 'margin-bottom: 10px; color: var(--color-text-secondary);'
            })
        ]);

        if (!appState.currentGroupId) {
            emptyCard.appendChild(utils.createElement('button', {
                className: 'btn btn-primary',
                textContent: '+ Add Category',
                onClick: () => showPage('settings')
            }));
        } else {
            emptyCard.appendChild(utils.createElement('p', {
                textContent: 'Manage shared categories in Settings > Groups.',
                style: 'font-size: 0.8rem; color: var(--color-text-muted);'
            }));
        }

        container.appendChild(emptyCard);
        return;
    }

    visibleCategories.forEach(category => {
        // Calculate total for this category
        const categoryExpenses = expenses.filter(exp => exp.categoryId?._id === category._id || exp.categoryId === category._id);
        const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        const card = utils.createElement('div', {
            className: 'category-card',
            dataId: category._id,
            onClick: () => openCategoryDetail(category)
        }, [
            utils.createElement('div', { className: 'category-icon', textContent: category.icon }),
            utils.createElement('p', { className: 'category-name', textContent: category.name }),
            utils.createElement('p', { className: 'category-amount', textContent: `${utils.formatCurrency(total)} ETB` }),
            utils.createElement('p', { className: 'category-updated', textContent: `Updated ${utils.getRelativeDate(category.lastUpdated)}` })
        ]);

        container.appendChild(card);
    });
}

function renderRecentExpensesData(expenses, categories) {
    const recentHeaderContainer = document.querySelector('#home-page .recent-expenses-section .section-header');
    const isHidden = localStorage.getItem('recentExpensesHidden') === 'true';

    if (recentHeaderContainer) {
        // Layout: [Title + Toggle] ... [See All on right]
        recentHeaderContainer.style.display = 'flex';
        recentHeaderContainer.style.alignItems = 'center';
        recentHeaderContainer.style.justifyContent = 'space-between';
        recentHeaderContainer.style.gap = '10px';

        recentHeaderContainer.innerHTML = '';

        // Left side: Title + Toggle grouped together
        const leftGroup = utils.createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
            utils.createElement('h3', { textContent: 'Recent Expenses', style: 'margin: 0;' }),
            utils.createElement('button', {
                id: 'toggle-recent-expenses',
                className: 'privacy-toggle',
                style: 'background: none; border: none; cursor: pointer; opacity: 0.7; padding: 0; display: flex; align-items: center;',
                innerHTML: isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>',
                onClick: (e) => {
                    e.stopPropagation();
                    const currentHidden = localStorage.getItem('recentExpensesHidden') === 'true';
                    localStorage.setItem('recentExpensesHidden', !currentHidden);
                    renderRecentExpensesData(window.appData.expenses || [], window.appData.categories || []);
                }
            })
        ]);

        // Right side: See All link
        const seeAllLink = utils.createElement('a', {
            href: '#',
            className: 'see-all-link',
            id: 'goto-report',
            textContent: 'See All',
            style: 'font-size: 0.9rem; text-decoration: none; color: var(--color-primary);'
        });

        seeAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('report');
        });

        recentHeaderContainer.append(leftGroup, seeAllLink);
    }

    const tbody = utils.$('#recent-expenses-body');
    tbody.innerHTML = '';

    if (isHidden) {
        const row = utils.createElement('tr', {}, [
            utils.createElement('td', {
                colSpan: 4,
                textContent: '**** Hidden ****',
                style: 'text-align: center; padding: 20px; color: var(--color-text-muted);'
            })
        ]);
        tbody.appendChild(row);
        return;
    }

    const recentExpenses = utils.sortBy(expenses, 'date', 'desc').slice(0, 5);

    // Empty State
    if (recentExpenses.length === 0) {
        const emptyRow = utils.createElement('tr', {}, [
            utils.createElement('td', {
                colSpan: 4,
                textContent: 'No expenses yet. Tap + to add your first expense!',
                style: 'text-align: center; padding: 20px; color: var(--color-text-secondary); font-style: italic;'
            })
        ]);
        tbody.appendChild(emptyRow);
        return;
    }

    recentExpenses.forEach(expense => {
        const category = typeof expense.categoryId === 'object'
            ? expense.categoryId
            : categories.find(cat => cat._id === expense.categoryId);

        const row = utils.createElement('tr', {
            dataId: expense._id,
            onClick: () => openEditExpense(expense)
        }, [
            utils.createElement('td', { textContent: utils.getRelativeDate(expense.date) }),
            utils.createElement('td', { textContent: expense.reason }),
            utils.createElement('td', {
                innerHTML: `<span class="expense-category-badge">${category?.icon || '📦'} ${category?.name || 'Other'}</span>`
            }),
            utils.createElement('td', {
                className: 'expense-amount',
                textContent: `${utils.formatCurrency(expense.amount)} ETB`
            })
        ]);

        tbody.appendChild(row);
    });
}

// Chart functions moved to bottom to use processChartData

// ===================================
// Category Detail Page
// ===================================

async function openCategoryDetail(category) {
    appState.selectedCategory = category;

    try {
        // Update header
        utils.$('#category-title').textContent = `${category.icon} ${category.name} Expenses`;

        // Fetch expenses for this category
        // Fetch expenses for this category and current group
        const expenses = await api.getExpenses({
            categoryId: category._id,
            groupId: appState.currentGroupId || undefined
        });

        // Render logic for Category Detail
        const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // This month expenses
        const now = new Date();
        const thisMonthExpenses = expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
        });
        const monthTotal = thisMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Update DOM
        const totalEl = utils.$('#category-total');
        const monthEl = utils.$('#category-month');

        const totalHtml = `${utils.formatCurrency(totalSpent)} <span style="font-size: 0.6em; color: var(--color-text-secondary);">ETB</span>`;
        const monthHtml = `${utils.formatCurrency(monthTotal)} <span style="font-size: 0.6em; color: var(--color-text-secondary);">ETB</span>`;

        totalEl.innerHTML = totalHtml;
        monthEl.innerHTML = monthHtml;

        // Single Toggle Eye for both values with localStorage persistence
        const eyeBtn = utils.$('#toggle-cat-eye');
        if (eyeBtn) {
            // Check localStorage for persisted hidden state (use same key as home page)
            const isHidden = localStorage.getItem('expenseAmountsHidden') === 'true';

            if (isHidden) {
                totalEl.textContent = '****';
                monthEl.textContent = '****';
                totalEl.dataset.hidden = 'true';
                monthEl.dataset.hidden = 'true';
                eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                totalEl.dataset.hidden = 'false';
                monthEl.dataset.hidden = 'false';
                eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }

            eyeBtn.onclick = (e) => {
                e.stopPropagation();
                if (totalEl.dataset.hidden === 'true') {
                    // Show values
                    totalEl.innerHTML = totalHtml;
                    monthEl.innerHTML = monthHtml;
                    totalEl.dataset.hidden = 'false';
                    monthEl.dataset.hidden = 'false';
                    eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
                    localStorage.setItem('expenseAmountsHidden', 'false');
                } else {
                    // Hide values
                    totalEl.textContent = '****';
                    monthEl.textContent = '****';
                    totalEl.dataset.hidden = 'true';
                    monthEl.dataset.hidden = 'true';
                    eyeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    localStorage.setItem('expenseAmountsHidden', 'true');
                }
            };
        }

        // Render expenses table
        renderCategoryExpenses(expenses);

        // Initialize chart
        updateCategoryChart('weekly');

        showPage('category');

        // Back button handler uses History API now via showPage pushState
        utils.$('#category-back').onclick = () => window.history.back();
    } catch (e) {
        utils.showToast('Failed to load category details', 'error');
    }
}


function renderCategoryExpenses(expenses) {
    const tbody = utils.$('#category-expenses-body');
    const sortedExpenses = utils.sortBy(expenses, 'date', 'desc');

    tbody.innerHTML = '';

    sortedExpenses.forEach(expense => {
        const row = utils.createElement('tr', {
            dataId: expense._id,
            onClick: () => openEditExpense(expense)
        }, [
            utils.createElement('td', { textContent: new Date(expense.date).toLocaleDateString() }),
            utils.createElement('td', { textContent: expense.reason }),
            utils.createElement('td', {
                className: 'expense-amount',
                textContent: `${utils.formatCurrency(expense.amount)} ETB`
            })
        ]);

        tbody.appendChild(row);
    });
}

// ===================================
// Add Expense Page
// ===================================

function initAddExpense() {
    const form = utils.$('#expense-form');
    const reasonInput = utils.$('#expense-reason');
    const suggestionsDropdown = utils.$('#reason-suggestions');
    const dateOptions = utils.$$('.date-option');
    const customDateInput = utils.$('#custom-date');

    // Back button
    utils.$('#add-expense-back').addEventListener('click', () => {
        showPage('home');
    });

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddExpense();
    });

    // Reason autocomplete
    reasonInput.addEventListener('input', utils.debounce((e) => {
        const query = e.target.value;
        if (query.length >= 2) {
            showReasonSuggestions(query);
        } else {
            suggestionsDropdown.classList.add('hidden');
        }
    }, 200));

    reasonInput.addEventListener('blur', () => {
        setTimeout(() => suggestionsDropdown.classList.add('hidden'), 200);
    });

    // Date options
    dateOptions.forEach(option => {
        option.addEventListener('click', () => {
            dateOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            appState.selectedDate = option.dataset.date;

            if (option.dataset.date === 'custom') {
                customDateInput.classList.remove('hidden');
                customDateInput.focus();
            } else {
                customDateInput.classList.add('hidden');
            }
        });
    });
}

async function renderAddExpense() {
    try {
        // Render category chips from API
        const selector = utils.$('#category-selector');
        selector.innerHTML = '';

        const categories = await api.getCategories(appState.currentGroupId);

        categories.filter(cat => cat.isVisible).forEach((category, index) => {
            const chip = utils.createElement('div', {
                className: 'category-chip', // Modified: No default active
                dataId: category._id,
                onClick: (e) => {
                    utils.$$('.category-chip').forEach(c => c.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                }
            }, [
                utils.createElement('span', { className: 'category-chip-icon', textContent: category.icon }),
                category.name
            ]);

            selector.appendChild(chip);
        });

        // Fetch previous reasons for autocomplete
        const expenses = await api.getExpenses();
        const uniqueReasons = [...new Set(expenses.map(exp => exp.reason))];
        window.appData.previousReasons = uniqueReasons;

        // Reset form
        utils.$('#expense-amount').value = '';
        utils.$('#expense-reason').value = '';
        utils.$$('.date-option').forEach((o, i) => {
            o.classList.toggle('active', i === 0);
        });
        utils.$('#custom-date').classList.add('hidden');
        appState.selectedDate = 'today';
    } catch (e) {
        utils.showToast('Failed to load categories', 'error');
    }
}

function showReasonSuggestions(query) {
    const dropdown = utils.$('#reason-suggestions');
    // Combine static and dynamic reasons
    const allReasons = [...new Set([
        ...(window.appData.previousReasons || []),
        ...(window.appData.expenses ? window.appData.expenses.map(e => e.reason) : [])
    ])];

    const suggestions = utils.fuzzySearch(query, allReasons);

    if (suggestions.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.innerHTML = '';
    suggestions.slice(0, 5).forEach(suggestion => {
        const item = utils.createElement('div', {
            className: 'autocomplete-item',
            onMousedown: (e) => { // Modified: Use mousedown to prevent blur
                e.preventDefault();
                utils.$('#expense-reason').value = suggestion;
                dropdown.classList.add('hidden');
            }
        }, [
            utils.createElement('span', { className: 'suggestion-icon', textContent: '💡' }),
            utils.createElement('span', {
                className: 'suggestion-text',
                innerHTML: utils.highlightMatch(suggestion, query)
            })
        ]);

        dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
}

async function handleAddExpense() {
    const amount = parseFloat(utils.$('#expense-amount').value);
    const reason = utils.$('#expense-reason').value;
    const activeCategory = utils.$('.category-chip.active');
    const categoryId = activeCategory?.dataset.id;

    if (!categoryId) {
        utils.showToast('Please select a category', 'error');
        return;
    }

    if (!amount || !reason) {
        utils.showToast('Please fill all fields', 'error');
        return;
    }

    // Calculate date
    let date = new Date();
    switch (appState.selectedDate) {
        case 'yesterday':
            date.setDate(date.getDate() - 1);
            break;
        case '2days':
            date.setDate(date.getDate() - 2);
            break;
        case 'custom':
            date = new Date(utils.$('#custom-date').value);
            break;
    }

    try {
        utils.showToast('Saving expense...', 'info');

        // Create new expense on backend
        const expenseData = {
            categoryId,
            amount,
            reason,
            date: date.toISOString(),
            dateEthiopian: utils.toEthiopianDate(date),
            // Ensure strictly undefined if null or invalid
            groupId: (appState.currentGroupId && appState.currentGroupId !== 'null') ? appState.currentGroupId : undefined
        };

        await api.createExpense(expenseData);

        utils.showToast('Expense added successfully!', 'success');

        // Update local suggestion list
        if (!window.appData.previousReasons.includes(reason)) {
            window.appData.previousReasons.push(reason);
        }

        renderHome();
        showPage('home');
    } catch (e) {
        utils.showToast(e.message, 'error');
    }
}

// ===================================
// Report Page
// ===================================

function initReport() {
    const searchInput = utils.$('#search-expenses');
    const filterToggle = utils.$('#filter-toggle');
    const filterPanel = utils.$('#filter-panel');
    const applyFilters = utils.$('#apply-filters');
    const chartSection = utils.$('#report-page .chart-section');

    // Search - hide chart when searching
    searchInput.addEventListener('input', utils.debounce((e) => {
        appState.filters.search = e.target.value;

        // Hide chart when searching, show when cleared
        if (chartSection) {
            if (e.target.value.trim()) {
                chartSection.classList.add('search-active');
            } else {
                chartSection.classList.remove('search-active');
            }
        }

        renderReportExpenses();
    }, 200));

    // Filter toggle
    filterToggle.addEventListener('click', () => {
        filterPanel.classList.toggle('hidden');
    });

    // Apply filters
    applyFilters.addEventListener('click', () => {
        appState.filters.dateFrom = utils.$('#filter-date-from').value || null;
        appState.filters.dateTo = utils.$('#filter-date-to').value || null;
        appState.filters.amountMin = parseFloat(utils.$('#filter-amount-min').value) || null;
        appState.filters.amountMax = parseFloat(utils.$('#filter-amount-max').value) || null;

        renderReportExpenses();
        filterPanel.classList.add('hidden');
        utils.showToast('Filters applied', 'info');
    });

    // Period selector
    utils.$$('#report-page .period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            utils.$$('#report-page .period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                const expenses = await api.getExpenses();
                updateReportChartWithData(expenses, btn.dataset.period);
            } catch (e) {
                utils.showToast('Failed to update chart', 'error');
            }
        });
    });
}

async function renderReport() {
    try {
        const expenses = await api.getExpenses({ groupId: appState.currentGroupId || undefined });
        renderReportExpenses();
        updateReportChartWithData(expenses, 'weekly');
    } catch (e) {
        console.error('Report render error:', e);
    }
}

async function renderReportExpenses() {
    const tbody = utils.$('#all-expenses-body');

    try {
        // Fetch filtered expenses from API
        const filters = {
            search: appState.filters.search || '',
            dateFrom: appState.filters.dateFrom || '',
            dateTo: appState.filters.dateTo || '',
            amountMin: appState.filters.amountMin || '',
            amountMax: appState.filters.amountMax || '',
            groupId: appState.currentGroupId || undefined
        };

        const expenses = await api.getExpenses(filters);
        const categories = await api.getCategories();

        tbody.innerHTML = '';

        if (expenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
                        No expenses found
                    </td>
                </tr>
            `;
            return;
        }

        expenses.forEach(expense => {
            const category = typeof expense.categoryId === 'object'
                ? expense.categoryId
                : categories.find(cat => cat._id === expense.categoryId);

            const row = utils.createElement('tr', {
                dataId: expense._id,
                onClick: () => openEditExpense(expense)
            }, [
                utils.createElement('td', { textContent: utils.getRelativeDate(expense.date) }),
                utils.createElement('td', {
                    innerHTML: appState.filters.search
                        ? utils.highlightMatch(expense.reason, appState.filters.search)
                        : expense.reason
                }),
                utils.createElement('td', {
                    innerHTML: `<span class="expense-category-badge">${category?.icon || '📦'} ${category?.name || 'Other'}</span>`
                }),
                utils.createElement('td', {
                    className: 'expense-amount',
                    textContent: `${utils.formatCurrency(expense.amount)} ETB`
                })
            ]);

            tbody.appendChild(row);
        });

        // Update chart with filtered data
        const activePeriod = utils.$('#report-page .period-btn.active')?.dataset.period || 'weekly';
        updateReportChartWithData(expenses, activePeriod);
    } catch (e) {
        utils.showToast('Failed to load reports', 'error');
    }
}

// Chart functions moved to bottom

// ===================================
// Settings Page
// ===================================

function initSettings() {
    const darkModeToggle = utils.$('#dark-mode-toggle');
    const fontDecrease = utils.$('#font-decrease');
    const fontIncrease = utils.$('#font-increase');
    const addCategoryBtn = utils.$('#add-category-btn');
    const logoutBtn = utils.$('#logout-btn');
    const changePasswordBtn = utils.$('#change-password-btn');

    // Language Selector
    const langSelector = utils.$('#language-selector');
    if (langSelector) {
        langSelector.addEventListener('change', (e) => {
            if (window.i18n) {
                window.i18n.setLanguage(e.target.value);
            }
        });
    }

    // Dark mode toggle
    darkModeToggle.addEventListener('change', async (e) => {
        try {
            document.documentElement.dataset.theme = e.target.checked ? 'dark' : 'light';
            await api.updateSettings({ darkMode: e.target.checked });
            // Update local storage
            const user = JSON.parse(localStorage.getItem('currentUser'));
            user.settings.darkMode = e.target.checked;
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (err) {
            utils.showToast('Failed to save theme setting', 'error');
        }
    });

    // Font size controls
    const fontSizes = ['small', 'medium', 'large'];

    fontDecrease.addEventListener('click', async () => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        let currentFontIndex = fontSizes.indexOf(user.settings.fontSize);
        if (currentFontIndex > 0) {
            currentFontIndex--;
            await updateFontSize(fontSizes[currentFontIndex]);
        }
    });

    fontIncrease.addEventListener('click', async () => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        let currentFontIndex = fontSizes.indexOf(user.settings.fontSize);
        if (currentFontIndex < fontSizes.length - 1) {
            currentFontIndex++;
            await updateFontSize(fontSizes[currentFontIndex]);
        }
    });

    // Add category - Reset for clean add
    addCategoryBtn.addEventListener('click', () => {
        const form = utils.$('#add-category-form');
        if (form) form.reset();
        const hiddenInput = utils.$('#category-id-hidden');
        if (hiddenInput) hiddenInput.remove();
        const header = utils.$('#add-category-modal h3');
        if (header) header.textContent = 'Add Category';
        const submitBtn = utils.$('#add-category-form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Category';
        utils.showModal('add-category-modal');
        renderIconSelector();
    });

    // Save Budget Settings Button
    const budgetSettings = utils.$('#budget-alert-settings');
    if (budgetSettings && !utils.$('#save-budget-btn')) {
        const saveBudgetBtn = utils.createElement('button', {
            id: 'save-budget-btn',
            className: 'btn btn-primary btn-sm',
            textContent: 'Save Alert',
            style: 'margin-top: 10px;',
            onClick: async () => {
                const limit = parseFloat(utils.$('#budget-limit').value);
                const enabled = utils.$('#budget-alert-toggle').checked;

                // Request notification permission if enabled
                if (enabled && 'Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                try {
                    await api.updateSettings({ budgetLimit: limit, budgetAlertEnabled: enabled });
                    utils.showToast('Budget settings saved', 'success');
                } catch (e) { utils.showToast('Failed to save', 'error'); }
            }
        });
        budgetSettings.appendChild(saveBudgetBtn);
    }

    // Save Reminder Settings Button
    const reminderOptions = document.querySelector('.reminder-options');
    if (reminderOptions && !utils.$('#save-reminder-btn')) {
        const saveReminderBtn = utils.createElement('button', {
            id: 'save-reminder-btn',
            className: 'btn btn-primary btn-sm',
            textContent: 'Save Schedule',
            style: 'margin-top: 10px; width: 100%;',
            onClick: async () => {
                const selected = document.querySelector('input[name="reminder"]:checked')?.value;
                if (selected) {
                    try {
                        await api.updateSettings({ reminderSchedule: selected });
                        utils.showToast('Reminder schedule saved', 'success');
                    } catch (e) { utils.showToast('Failed to save', 'error'); }
                }
            }
        });
        reminderOptions.appendChild(saveReminderBtn);
    }

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Change password - open modal
    changePasswordBtn.addEventListener('click', () => {
        utils.showModal('password-modal');
    });

    // Profile image upload
    const changePhotoBtn = utils.$('#change-photo-btn');
    const profileImageInput = utils.$('#profile-image-input');

    if (changePhotoBtn && profileImageInput) {
        changePhotoBtn.addEventListener('click', () => {
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                utils.showToast('Image size must be less than 2MB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Image = event.target.result;
                try {
                    await api.updateSettings({ profileImage: base64Image });
                    const user = JSON.parse(localStorage.getItem('currentUser'));
                    user.profileImage = base64Image;
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    utils.$('#settings-profile-img').src = base64Image;
                    const homeAvatar = utils.$('.profile-avatar img');
                    if (homeAvatar) homeAvatar.src = base64Image;
                    utils.showToast('Profile photo updated!', 'success');
                } catch (err) {
                    utils.showToast('Failed to update profile photo', 'error');
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

async function renderSettings() {
    try {
        const user = await api.getProfile();
        localStorage.setItem('currentUser', JSON.stringify(user));

        // Update profile info
        utils.$('#settings-username').textContent = user.username;
        utils.$('#settings-phone').textContent = user.phone;

        // Update profile image or initials
        const profileImg = utils.$('#settings-profile-img');
        if (user.profileImage) {
            profileImg.src = user.profileImage;
        } else {
            const initials = utils.getInitials(user.username);
            profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=333&color=fff&size=100&bold=true`;
        }

        // Update budget limit in UI
        const budgetLimitInput = utils.$('#budget-limit');
        if (budgetLimitInput && user.settings?.budgetLimit) {
            budgetLimitInput.value = user.settings.budgetLimit;
        }

        // Update toggles
        utils.$('#dark-mode-toggle').checked = user.settings.darkMode;
        utils.$('#budget-alert-toggle').checked = user.settings.budgetAlertEnabled;
        utils.$('#budget-limit').value = user.settings.budgetLimit;

        // Update font size display
        utils.$('#font-size-value').textContent =
            user.settings.fontSize.charAt(0).toUpperCase() +
            user.settings.fontSize.slice(1);

        // Render categories list
        renderSettingsCategories();
    } catch (e) {
        utils.showToast('Failed to load settings', 'error');
    }
}

async function renderSettingsCategories() {
    const container = utils.$('#settings-categories');
    container.innerHTML = '';

    try {
        const categories = await api.getCategories();
        const expenses = await api.getExpenses();

        categories.forEach(category => {
            const categoryExpenses = expenses.filter(exp => exp.categoryId?._id === category._id || exp.categoryId === category._id);

            const item = utils.createElement('div', {
                className: 'category-list-item',
                style: category.isVisible ? '' : 'opacity: 0.5'
            }, [
                utils.createElement('div', { className: 'category-list-icon', textContent: category.icon }),
                utils.createElement('div', { className: 'category-list-info' }, [
                    utils.createElement('p', { className: 'category-list-name', textContent: category.name }),
                    utils.createElement('p', { className: 'category-list-count', textContent: `${categoryExpenses.length} expenses` })
                ]),
                utils.createElement('div', { className: 'category-actions' }, [
                    utils.createElement('button', {
                        className: 'category-action-btn hide-btn',
                        textContent: category.isVisible ? '👁️' : '👁️‍🗨️',
                        onClick: () => toggleCategoryVisibility(category)
                    }),
                    utils.createElement('button', {
                        className: 'category-action-btn',
                        textContent: '✏️',
                        onClick: () => editCategory(category)
                    })
                ])
            ]);

            container.appendChild(item);
        });
    } catch (e) {
        utils.showToast('Failed to load categories in settings', 'error');
    }
}

async function updateFontSize(size) {
    try {
        document.documentElement.dataset.fontSize = size;
        await api.updateSettings({ fontSize: size });
        utils.$('#font-size-value').textContent = size.charAt(0).toUpperCase() + size.slice(1);

        const user = JSON.parse(localStorage.getItem('currentUser'));
        user.settings.fontSize = size;
        localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {
        utils.showToast('Failed to save font size setting', 'error');
    }
}

async function toggleCategoryVisibility(category) {
    try {
        const isVisible = !category.isVisible;
        await api.updateCategory(category._id, { isVisible });
        renderSettingsCategories();
        utils.showToast(
            isVisible ? 'Category shown' : 'Category hidden (data preserved)',
            'info'
        );
    } catch (e) {
        utils.showToast('Failed to update category visibility', 'error');
    }
}

function editCategory(category) {
    const modal = utils.$('#add-category-modal');
    const form = utils.$('#add-category-form');
    if (!modal || !form) return;

    // Set modal title
    const header = modal.querySelector('h3');
    if (header) header.textContent = 'Edit Category';

    // Fill form with existing data
    utils.$('#category-name').value = category.name;
    appState.selectedCategoryIcon = category.icon;
    renderIconSelector();

    // Add hidden input with category ID for update
    let idInput = utils.$('#category-id-hidden');
    if (!idInput) {
        idInput = utils.createElement('input', { type: 'hidden', id: 'category-id-hidden' });
        form.appendChild(idInput);
    }
    idInput.value = category._id;

    // Update button text
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.textContent = 'Update Category';

    utils.showModal('add-category-modal');
}

// ===================================
// Modals
// ===================================

function initModals() {
    // Edit expense modal
    const closeEditModal = utils.$('#close-edit-modal');
    const editExpenseForm = utils.$('#edit-expense-form');
    const deleteExpenseBtn = utils.$('#delete-expense-btn');

    closeEditModal.addEventListener('click', () => {
        utils.hideModal('edit-expense-modal');
    });

    editExpenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleEditExpense();
    });

    if (deleteExpenseBtn) {
        deleteExpenseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleDeleteExpense();
        });
    }

    // Add category modal
    const closeCategoryModal = utils.$('#close-category-modal');
    const addCategoryForm = utils.$('#add-category-form');

    closeCategoryModal.addEventListener('click', () => {
        utils.hideModal('add-category-modal');
    });

    addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddCategory();
    });

    const closeModals = () => {
        utils.$$('.modal').forEach(modal => modal.classList.add('hidden'));
        document.body.style.overflow = '';
    };

    // Close buttons logic
    utils.$$('.modal-close').forEach(btn => btn.addEventListener('click', closeModals));

    // Close modals on backdrop click
    utils.$$('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', closeModals);
    });
}

function openEditExpense(expense) {
    if (!expense) return;

    const id = expense._id || expense.id;
    if (!id) {
        utils.showToast('Could not identify expense ID', 'error');
        return;
    }

    appState.selectedExpenseId = id;

    // Populate fields
    utils.$('#edit-expense-id').value = id;
    utils.$('#edit-amount').value = expense.amount || 0;
    utils.$('#edit-reason').value = expense.reason || '';
    utils.$('#edit-date').value = utils.formatDateForInput(expense.date || new Date());

    // Populate Category Selector
    const catContainer = utils.$('#edit-category-selector');
    if (catContainer && window.appData.categories) {
        catContainer.innerHTML = '';
        const currentCatId = expense.categoryId?._id || expense.categoryId;

        appState.selectedEditCategory = currentCatId; // Set initial value

        window.appData.categories.forEach(cat => {
            const isSelected = cat._id === currentCatId;
            const el = utils.createElement('div', {
                className: 'category-item-edit',
                innerHTML: `<span style="font-size: 24px;">${cat.icon}</span><div style="font-size: 10px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cat.name}</div>`,
                style: `cursor: pointer; padding: 8px; border-radius: 8px; background: ${isSelected ? 'var(--color-primary-light)' : 'var(--color-background)'}; text-align: center; border: 2px solid ${isSelected ? 'var(--color-primary)' : 'transparent'}; transition: all 0.2s; aspect-ratio: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;`,
                onClick: (e) => {
                    // Deselect others
                    catContainer.querySelectorAll('.category-item-edit').forEach(c => {
                        c.style.borderColor = 'transparent';
                        c.style.background = 'var(--color-background)';
                    });
                    // Select this
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.background = 'var(--color-primary-light)';
                    appState.selectedEditCategory = cat._id;
                }
            });
            catContainer.appendChild(el);
        });
    }

    utils.showModal('edit-expense-modal');
}

async function handleDeleteExpense() {
    const id = utils.$('#edit-expense-id').value;
    if (!id) return;

    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
        utils.showToast('Deleting expense...', 'info');
        await api.deleteExpense(id); // Use 'id' from the form, not 'expense._id'
        utils.showToast(navigator.onLine ? 'Expense deleted' : 'Marked for deletion (Offline)', 'success');
        utils.hideModal('edit-expense-modal');

        // Refresh data
        if (appState.currentPage === 'home') await renderHome();
        else if (appState.currentPage === 'report') await renderReportExpenses(); // Added this line back
        else if (appState.currentPage === 'category') await openCategoryDetail(appState.selectedCategory);
    } catch (e) {
        utils.showToast(e.message, 'error');
    }
}

async function handleEditExpense() {
    const id = utils.$('#edit-expense-id').value;
    const amount = parseFloat(utils.$('#edit-amount').value);
    const reason = utils.$('#edit-reason').value;
    const date = utils.$('#edit-date').value;
    const categoryId = appState.selectedEditCategory;

    if (!id || isNaN(amount) || !reason || !date) {
        utils.showToast('Please fill all fields', 'error');
        return;
    }

    try {
        utils.showToast('Updating expense...', 'info');
        await api.updateExpense(id, {
            amount,
            reason,
            categoryId, // Include updated category
            date: new Date(date).toISOString(),
            dateEthiopian: utils.toEthiopianDate(date)
        });

        utils.hideModal('edit-expense-modal');
        utils.showToast('Expense updated successfully!', 'success');

        // Refresh current page
        if (appState.currentPage === 'home') {
            await renderHome();
        } else if (appState.currentPage === 'report') {
            await renderReportExpenses();
        } else if (appState.currentPage === 'category') {
            await openCategoryDetail(appState.selectedCategory);
        }
    } catch (e) {
        utils.showToast(e.message, 'error');
    }
}

function renderIconSelector() {
    const container = utils.$('#icon-selector');
    container.innerHTML = '';

    window.appData.availableIcons.forEach(icon => {
        const option = utils.createElement('div', {
            className: `icon-option ${icon === appState.selectedCategoryIcon ? 'selected' : ''}`,
            textContent: icon,
            onClick: (e) => {
                utils.$$('.icon-option').forEach(o => o.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                appState.selectedCategoryIcon = icon;
            }
        });

        container.appendChild(option);
    });
}

async function handleAddCategory() {
    const name = utils.$('#category-name').value;
    const idInput = utils.$('#category-id-hidden');
    const isEdit = idInput && idInput.value;

    if (!name) {
        utils.showToast('Please enter a category name', 'error');
        return;
    }

    try {
        if (isEdit) {
            utils.showToast('Updating category...', 'info');
            await api.updateCategory(idInput.value, {
                name,
                icon: appState.selectedCategoryIcon
            });
            utils.showToast('Category updated!', 'success');
        } else {
            utils.showToast('Creating category...', 'info');
            await api.createCategory({
                name,
                icon: appState.selectedCategoryIcon
            });
            utils.showToast('Category added successfully!', 'success');
        }

        utils.hideModal('add-category-modal');
        utils.$('#category-name').value = '';
        if (idInput) idInput.value = '';

        renderSettingsCategories();
    } catch (e) {
        utils.showToast(e.message, 'error');
    }
}

// ===================================
// Date Picker Modal
// ===================================

// Calendar state
const calendarState = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: null,
    context: 'expense' // 'expense' or 'reminder'
};

function initDatePicker() {
    const closeDatePicker = utils.$('#close-date-picker');
    const prevMonthBtn = utils.$('#prev-month');
    const nextMonthBtn = utils.$('#next-month');
    const confirmDateBtn = utils.$('#confirm-date');

    if (closeDatePicker) {
        closeDatePicker.addEventListener('click', () => {
            utils.hideModal('date-picker-modal');
        });
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            calendarState.currentMonth--;
            if (calendarState.currentMonth < 0) {
                calendarState.currentMonth = 11;
                calendarState.currentYear--;
            }
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            calendarState.currentMonth++;
            if (calendarState.currentMonth > 11) {
                calendarState.currentMonth = 0;
                calendarState.currentYear++;
            }
            renderCalendar();
        });
    }

    if (confirmDateBtn) {
        confirmDateBtn.addEventListener('click', () => {
            if (calendarState.selectedDate) {
                handleDateSelection();
            } else {
                utils.showToast('Please select a date', 'error');
            }
        });
    }

    // Set up "Specific Date" reminder option click
    const reminderOptions = utils.$$('input[name="reminder"]');
    reminderOptions.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                openDatePicker('reminder');
            }
        });
    });

    // Set up custom date option in Add Expense
    const customDateOption = utils.$('.date-option[data-date="custom"]');
    if (customDateOption) {
        customDateOption.addEventListener('click', (e) => {
            // Prevent the default behavior first
            e.preventDefault();
            e.stopPropagation();

            // Remove active from all, add to custom
            utils.$$('.date-option').forEach(o => o.classList.remove('active'));
            customDateOption.classList.add('active');

            // Open date picker modal
            openDatePicker('expense');
        });
    }
}

function openDatePicker(context = 'expense') {
    calendarState.context = context;
    calendarState.currentMonth = new Date().getMonth();
    calendarState.currentYear = new Date().getFullYear();
    calendarState.selectedDate = null;

    renderCalendar();
    utils.showModal('date-picker-modal');
}

function renderCalendar() {
    const calendarTitle = utils.$('#calendar-title');
    const calendarDays = utils.$('#calendar-days');
    if (!calendarTitle || !calendarDays) return;

    const isAmharic = window.i18n && window.i18n.currentLanguage === 'am';

    if (isAmharic) {
        renderEthiopianGrid(calendarTitle, calendarDays);
    } else {
        renderGregorianGrid(calendarTitle, calendarDays);
    }
}

function renderGregorianGrid(calendarTitle, calendarDays) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    calendarTitle.textContent = `${monthNames[calendarState.currentMonth]} ${calendarState.currentYear}`;

    const firstDayOfMonth = new Date(calendarState.currentYear, calendarState.currentMonth, 1);
    const lastDay = new Date(calendarState.currentYear, calendarState.currentMonth + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(calendarState.currentYear, calendarState.currentMonth, 0).getDate();

    calendarDays.innerHTML = '';
    const today = new Date();
    const isCurrentMonth = today.getMonth() === calendarState.currentMonth && today.getFullYear() === calendarState.currentYear;

    for (let i = startDay - 1; i >= 0; i--) {
        const dayEl = utils.createElement('div', { className: 'calendar-day other-month', textContent: prevMonthLastDay - i });
        calendarDays.appendChild(dayEl);
    }

    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(calendarState.currentYear, calendarState.currentMonth, day);
        const isToday = isCurrentMonth && day === today.getDate();
        const isSelected = calendarState.selectedDate && date.toDateString() === calendarState.selectedDate.toDateString();
        const dayEl = utils.createElement('div', {
            className: `calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`,
            textContent: day,
            onClick: () => selectCalendarDay(day)
        });
        calendarDays.appendChild(dayEl);
    }
}

function renderEthiopianGrid(calendarTitle, calendarDays) {
    // Basic Ethiopian Grid: 30 days for every month except Pagume
    const ethMonth = calendarState.currentMonth; // 0-12
    const ethYear = calendarState.currentYear - 8;

    calendarTitle.textContent = `${window.i18n.getEthiopianMonth(ethMonth)} ${ethYear}`;

    calendarDays.innerHTML = '';
    const totalDays = ethMonth === 12 ? 5 : 30; // Pagume has 5 or 6 (handled simply)

    // Attempt to calculate start day (weekday)
    // Meskerem 1, 2017 started on Wed (3)
    // We adjust based on months... Meskerem(30), Tikimt(30) etc. 30 % 7 = 2.
    // So each month shifts the start day by 2.
    const baseMeskerem1_2017 = 3; // Wed
    const monthShift = (ethMonth * 2) % 7;
    const startDay = (baseMeskerem1_2017 + monthShift) % 7;

    // Add empty slots for the start of the week
    for (let i = 0; i < startDay; i++) {
        const dayEl = utils.createElement('div', { className: 'calendar-day other-month' });
        calendarDays.appendChild(dayEl);
    }

    // Today's Ethiopian Date for highlighting (very rough check)
    const todayEth = window.i18n.toEthiopianDate(new Date());

    for (let day = 1; day <= totalDays; day++) {
        const isSelected = false; // Simplified
        const dayText = ethYear + '-' + (ethMonth + 1) + '-' + day;

        const dayEl = utils.createElement('div', {
            className: `calendar-day`,
            textContent: day,
            onClick: () => {
                // Approximate back-conversion to select a Gregorian date
                // We'll just set it to "now" but with a toast for the chosen day
                calendarState.selectedDate = new Date();
                utils.showToast(`Selected: ${window.i18n.getEthiopianMonth(ethMonth)} ${day}, ${ethYear}`, 'success');
                calendarDays.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
                dayEl.classList.add('selected');
            }
        });
        calendarDays.appendChild(dayEl);
    }
}

function selectCalendarDay(day) {
    calendarState.selectedDate = new Date(
        calendarState.currentYear,
        calendarState.currentMonth,
        day
    );
    renderCalendar();
}

function handleDateSelection() {
    const selectedDate = calendarState.selectedDate;

    if (!selectedDate) return;

    if (calendarState.context === 'expense') {
        // Set custom date for expense
        const customDateInput = utils.$('#custom-date');
        if (customDateInput) {
            customDateInput.value = utils.formatDateForInput(selectedDate);
        }
        appState.selectedDate = 'custom';
        utils.showToast(`Date set: ${selectedDate.toLocaleDateString()}`, 'success');
    } else if (calendarState.context === 'reminder') {
        // Store reminder date setting
        window.appData.userSettings.reminderDate = utils.formatDateForInput(selectedDate);
        utils.saveToStorage('userSettings', window.appData.userSettings);
        utils.showToast(`Reminder set for ${selectedDate.toLocaleDateString()}`, 'success');
    }

    utils.hideModal('date-picker-modal');
}

// Initialize date picker after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDatePicker, 100);
    setTimeout(initPasswordModal, 100);
    setTimeout(initDaysBeforeModal, 100);
    setTimeout(initNotifications, 100);
});

// ===================================
// Password Change Modal
// ===================================

function initPasswordModal() {
    const closeBtn = utils.$('#close-password-modal');
    const form = utils.$('#password-form');
    const newPasswordInput = utils.$('#new-password');
    const strengthBar = utils.$('#password-strength-bar');
    const hintText = utils.$('#password-hint');

    // Toggle password visibility for all password fields in modal
    utils.$$('#password-modal .toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            btn.style.opacity = type === 'password' ? '0.5' : '1';
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            utils.hideModal('password-modal');
            form.reset();
        });
    }

    // Password strength indicator
    if (newPasswordInput && strengthBar) {
        newPasswordInput.addEventListener('input', (e) => {
            const strength = utils.getPasswordStrength(e.target.value);
            strengthBar.className = 'password-strength-bar ' + strength;

            const hints = {
                weak: 'Weak - add more characters and symbols',
                medium: 'Medium - add numbers or symbols',
                strong: 'Strong password!'
            };
            if (hintText) hintText.textContent = hints[strength];
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handlePasswordChange();
        });
    }
}

function handlePasswordChange() {
    const currentPassword = utils.$('#current-password').value;
    const newPassword = utils.$('#new-password').value;
    const confirmPassword = utils.$('#confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        utils.showToast('Please fill all fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        utils.showToast('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        utils.showToast('Password must be at least 6 characters', 'error');
        return;
    }

    // Simulate password change
    utils.showToast('Password changed successfully!', 'success');
    utils.hideModal('password-modal');
    utils.$('#password-form').reset();
}

// ===================================
// Days Before Modal
// ===================================

function initDaysBeforeModal() {
    const closeBtn = utils.$('#close-days-before');
    const daysBeforeBtn = utils.$('#days-before-btn');
    const daysBtns = utils.$$('.days-option-btn');

    if (daysBeforeBtn) {
        daysBeforeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            utils.showModal('days-before-modal');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            utils.hideModal('days-before-modal');
        });
    }

    daysBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const days = parseInt(btn.dataset.days);
            handleDaysBeforeSelection(days);
        });
    });
}

function handleDaysBeforeSelection(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const customDateInput = utils.$('#custom-date');
    if (customDateInput) {
        customDateInput.value = utils.formatDateForInput(date);
    }

    appState.selectedDate = 'custom';

    // Update button text to show selection
    const daysBeforeBtn = utils.$('#days-before-btn');
    if (daysBeforeBtn) {
        daysBeforeBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            ${days} days ago
        `;
    }

    utils.hideModal('days-before-modal');
    utils.showToast(`Date set to ${days} days ago`, 'success');
}

// ===================================
// Notifications Panel
// ===================================

// Sample notifications
let notifications = [
    {
        id: 'n1',
        type: 'warning',
        title: 'Budget Alert',
        text: 'You have spent 80% of your monthly budget.',
        time: '2 hours ago',
        unread: true,
        category: 'manual'
    },
    {
        id: 'n2',
        type: 'success',
        title: 'Cloud Sync Active',
        text: 'Your data is securely synced to the cloud.',
        time: '5 hours ago',
        unread: false,
        category: 'manual'
    },
    {
        id: 'n3',
        type: 'info',
        title: 'Welcome to Mezgeb!',
        text: 'Start tracking your expenses by adding your first entry.',
        time: 'Since signup',
        unread: false,
        category: 'manual'
    }
];

function initNotifications() {
    const closeBtn = utils.$('#close-notifications');
    const notificationBell = utils.$('.notification-bell');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            utils.hideModal('notifications-modal');
        });
    }

    // Notification bell click - will be initialized when header is created
    // Duplicate notification listener removed (now handled in initHome)
    // if (notificationBell) { ... }
}

function renderNotifications() {
    const list = utils.$('#notifications-list');
    const empty = utils.$('#notifications-empty');

    if (!list) return;

    if (notifications.length === 0) {
        list.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    list.classList.remove('hidden');
    list.innerHTML = '';

    notifications.forEach(notif => {
        const item = utils.createElement('div', {
            className: `notification-item ${notif.unread ? 'unread' : ''}`,
            dataId: notif.id,
            onClick: () => markNotificationRead(notif.id)
        }, [
            utils.createElement('div', {
                className: `notification-indicator ${notif.type}`
            }),
            utils.createElement('div', { className: 'notification-content' }, [
                utils.createElement('p', {
                    className: 'notification-title',
                    textContent: notif.title
                }),
                utils.createElement('p', {
                    className: 'notification-text',
                    textContent: notif.text
                }),
                utils.createElement('span', {
                    className: 'notification-time',
                    textContent: notif.time
                })
            ])
        ]);

        list.appendChild(item);
    });
}

function markNotificationRead(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.unread = false;
        renderNotifications();
        updateNotificationBadge();
    }
}

function updateNotificationBadge() {
    const badge = utils.$('.notification-badge');
    const unreadCount = notifications.filter(n => n.unread).length;

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Add notification function for external use
function addNotification(type, title, text) {
    notifications.unshift({
        id: Date.now(),
        type,
        title,
        text,
        time: 'Just now',
        unread: true
    });
    updateNotificationBadge();
}

// Trigger system push notification
async function triggerPushNotification(title, body) {
    // Check if notifications are supported
    if (!('Notification' in window)) return;

    // Check permission
    if (Notification.permission === 'granted') {
        const options = {
            body: body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: 'budget-alert',
            renotify: true,
            requireInteraction: false
        };

        // Use Service Worker if available (better for PWA/Mobile)
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            try {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(title, options);
            } catch (e) {
                new Notification(title, options);
            }
        } else {
            new Notification(title, options);
        }
    }
}

// Generate notifications based on real expense data
function generateNotificationsFromExpenses(expenses, categories) {
    // Clear old auto-generated notifications (those without category 'manual')
    notifications = notifications.filter(n => n.category === 'manual');

    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    // Calculate this month's total
    const monthExpenses = expenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const monthTotal = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Get budget limit from user settings
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const budgetLimit = user?.settings?.budgetLimit || 10000;
    const budgetAlertEnabled = user?.settings?.budgetAlertEnabled !== false;

    // Budget alert
    if (monthTotal > budgetLimit && budgetAlertEnabled) {
        notifications.unshift({
            id: 'auto-budget-err',
            type: 'alert',
            title: 'Budget Exceeded!',
            text: `You've spent ${utils.formatCurrency(monthTotal)} ETB this month, exceeding your ${utils.formatCurrency(budgetLimit)} ETB limit.`,
            time: 'Now',
            unread: true
        });
        // Trigger system push notification
        triggerPushNotification('Budget Exceeded!', `You've spent ${utils.formatCurrency(monthTotal)} ETB, exceeding your ${utils.formatCurrency(budgetLimit)} ETB limit.`);
    } else if (monthTotal > budgetLimit * 0.8 && budgetAlertEnabled) {
        notifications.unshift({
            id: 'auto-budget-warn',
            type: 'warning',
            title: 'Budget Warning',
            text: `You've used ${Math.round((monthTotal / budgetLimit) * 100)}% of your monthly budget.`,
            time: 'Now',
            unread: true
        });
    }

    // Recent activity notification
    const recentExpenses = expenses.slice(0, 3);
    if (recentExpenses.length > 0) {
        const recentTotal = recentExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        notifications.unshift({
            id: 'auto-recent',
            type: 'info',
            title: 'Recent Activity',
            text: `${recentExpenses.length} recent expenses totaling ${utils.formatCurrency(recentTotal)} ETB.`,
            time: 'Today',
            unread: false
        });
    }

    // Top spending category
    if (categories.length > 0 && expenses.length > 0) {
        const categoryTotals = {};
        expenses.forEach(exp => {
            const catId = exp.categoryId?._id || exp.categoryId;
            categoryTotals[catId] = (categoryTotals[catId] || 0) + exp.amount;
        });
        const topCatId = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a])[0];
        const topCat = categories.find(c => c._id === topCatId);
        if (topCat) {
            notifications.unshift({
                id: 'auto-top-spend',
                type: 'insight',
                title: 'Top Spending',
                text: `${topCat.icon} ${topCat.name} is your highest spending category at ${utils.formatCurrency(categoryTotals[topCatId])} ETB.`,
                time: 'This month',
                unread: false
            });
        }
    }

    // If still no dynamic notifications and no manual ones, add a hint
    if (notifications.length === 0) {
        notifications.push({
            id: 'empty-hint',
            type: 'info',
            title: 'No Notifications',
            text: 'Your spending analysis will appear here.',
            time: 'System',
            unread: false
        });
    }

    updateNotificationBadge();
    renderNotifications();
}

// Show notification dropdown popup
function showNotificationDropdown() {
    // Remove existing dropdown if any
    const existing = utils.$('#notification-dropdown');
    if (existing) {
        existing.remove();
        return; // Toggle off
    }

    // Create dropdown
    const dropdown = utils.createElement('div', {
        id: 'notification-dropdown',
        className: 'notification-dropdown',
        style: 'position: fixed; top: 60px; right: 10px; width: 320px; max-height: 400px; overflow-y: auto; background: var(--color-surface); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 1000; padding: 16px;'
    });

    // Add header
    const header = utils.createElement('div', {
        style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;'
    }, [
        utils.createElement('h4', { textContent: 'Notifications', style: 'margin: 0; color: var(--color-text);' }),
        utils.createElement('button', {
            textContent: '✕',
            style: 'background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-text-secondary);',
            onClick: () => dropdown.remove()
        })
    ]);
    dropdown.appendChild(header);

    // Add notifications
    if (notifications.length === 0) {
        dropdown.appendChild(utils.createElement('p', {
            textContent: 'No notifications yet',
            style: 'color: var(--color-text-secondary); text-align: center; padding: 20px;'
        }));
    } else {
        notifications.forEach(notif => {
            const typeColors = {
                'alert': '#e74c3c',
                'warning': '#f39c12',
                'info': '#3498db',
                'insight': '#9b59b6'
            };

            const item = utils.createElement('div', {
                style: `padding: 12px; margin-bottom: 8px; background: ${notif.unread ? 'var(--color-background)' : 'transparent'}; border-radius: 8px; border-left: 3px solid ${typeColors[notif.type] || '#333'};`,
                onClick: () => {
                    notif.unread = false;
                    updateNotificationBadge();
                }
            }, [
                utils.createElement('p', {
                    textContent: notif.title,
                    style: 'font-weight: 600; margin: 0 0 4px 0; color: var(--color-text);'
                }),
                utils.createElement('p', {
                    textContent: notif.text,
                    style: 'font-size: 13px; margin: 0 0 4px 0; color: var(--color-text-secondary);'
                }),
                utils.createElement('span', {
                    textContent: notif.time,
                    style: 'font-size: 11px; color: var(--color-text-tertiary);'
                })
            ]);
            dropdown.appendChild(item);
        });
    }

    document.body.appendChild(dropdown);

    // Close dropdown when clicking outside
    const closeHandler = (e) => {
        if (!dropdown.contains(e.target) && !e.target.closest('.notification-bell')) {
            dropdown.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
}

// Dynamic Chart Functions with Data

function updateHomeChartWithData(expenses, period) {
    const canvasId = 'home-chart';
    let chart = window.chartManager.get(canvasId);

    if (!chart) {
        chart = window.chartManager.create(canvasId, 'bar');
    }

    const data = processChartData(expenses, period);

    if (chart) {
        chart.resize();
        chart.setData(data);
    }
}

function updateReportChartWithData(expenses, period) {
    const canvasId = 'report-chart';
    let chart = window.chartManager.get(canvasId);

    if (!chart) {
        chart = window.chartManager.create(canvasId, 'bar');
    }

    const data = processChartData(expenses, period);

    if (chart) {
        chart.resize();
        chart.setData(data);
    }
}

async function updateCategoryChart(period) {
    if (!appState.selectedCategory) return;

    const canvasId = 'category-chart';
    let chart = window.chartManager.get(canvasId);

    if (!chart) {
        chart = window.chartManager.create(canvasId, 'line');
    }

    try {
        const expenses = await api.getExpenses({ categoryId: appState.selectedCategory._id });
        const data = processChartData(expenses, period);

        if (chart) {
            chart.resize();
            chart.setData(data);
        }
    } catch (e) {
        console.error('Failed to update category chart:', e);
    }
}

// ===================================
// Chart Data Processing
// ===================================

function processChartData(expenses, period, limit = 7) {
    if (!expenses || expenses.length === 0) {
        return { labels: [], positive: [] };
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let labels = [];
    let positive = [];
    let groupMap = new Map();

    if (period === 'today') {
        // Today's expenses grouped by hour
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        // Group by 3-hour intervals
        const intervals = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
        intervals.forEach((label, i) => {
            groupMap.set(i, { label, amount: 0 });
        });

        expenses.forEach(exp => {
            const d = new Date(exp.date);
            if (d >= todayStart && d <= today) {
                const hour = d.getHours();
                const interval = Math.floor(hour / 3);
                if (groupMap.has(interval)) {
                    groupMap.get(interval).amount += exp.amount;
                }
            }
        });

    } else if (period === 'weekly') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const lang = window.i18n ? window.i18n.currentLanguage : 'en';
            const label = d.toLocaleDateString(lang, { weekday: 'short' });
            groupMap.set(key, { label, amount: 0 });
        }

        expenses.forEach(exp => {
            const d = new Date(exp.date);
            const expenseDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            if (groupMap.has(expenseDate)) {
                groupMap.get(expenseDate).amount += exp.amount;
            }
        });

    } else if (period === 'monthly') {
        // Last 4 weeks (approx) or weeks in month
        // Simplifying to last 5 weeks
        for (let i = 4; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - (i * 7));
            // Get start of week
            const day = d.getDay() || 7; // Get current day number, converting Sun. to 7
            if (day !== 1) d.setHours(-24 * (day - 1));

            const key = `Week ${utils.getWeekNumber(d)}`;
            groupMap.set(key, { label: key, amount: 0 });
        }

        expenses.forEach(exp => {
            const d = new Date(exp.date);
            const key = `Week ${utils.getWeekNumber(d)}`;
            // Only count if key exists in our range (simple check)
            // Ideally we check date range properly
            if (groupMap.has(key)) { // This is a loose check, might group separate years
                groupMap.get(key).amount += exp.amount;
            } else {
                // For now, let's just use the last 30 days grouped by 5-day intervals for monthly view
                // or just use day-by-day for current month?
                // Let's stick to a simpler "Last 30 Days" grouped by day if we want detail, or weeks.
                // Reverting to Monthly = Last 6 Months for better trend?
                // Let's do Monthly = Last 6 months
            }
        });

        // Redoing Monthly to be Last 6 Months for better visual
        groupMap.clear();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const lang = window.i18n ? window.i18n.currentLanguage : 'en';
            const label = d.toLocaleDateString(lang, { month: 'short' });
            groupMap.set(key, { label, amount: 0 });
        }

        expenses.forEach(exp => {
            const d = new Date(exp.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (groupMap.has(key)) {
                groupMap.get(key).amount += exp.amount;
            }
        });

    } else if (period === 'yearly') {
        // All months of current year
        const year = today.getFullYear();
        for (let i = 0; i < 12; i++) {
            const d = new Date(year, i, 1);
            const key = `${year}-${i}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            groupMap.set(key, { label, amount: 0 });
        }

        expenses.forEach(exp => {
            const d = new Date(exp.date);
            if (d.getFullYear() === year) {
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                if (groupMap.has(key)) {
                    groupMap.get(key).amount += exp.amount;
                }
            }
        });
    }

    groupMap.forEach(val => {
        labels.push(val.label);
        positive.push(val.amount);
    });

    return { labels, positive };
}



// ===================================
// Charts Initialization
// ===================================

function initCharts() {
    // Charts will be initialized when pages are loaded
}

// ===================================
// PDF Export
// ===================================

function showExportModal() {
    // Remove existing modal if any
    const existing = utils.$('#export-modal-dynamic');
    if (existing) existing.remove();

    // Create modal dynamically
    const modal = utils.createElement('div', {
        id: 'export-modal-dynamic',
        className: 'modal',
        style: 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;'
    });

    const content = utils.createElement('div', {
        className: 'modal-content',
        style: 'background: var(--color-surface); border-radius: 16px; padding: 24px; width: 90%; max-width: 400px;'
    }, [
        utils.createElement('h3', { textContent: 'Export to PDF', style: 'margin: 0 0 20px 0; color: var(--color-text);' }),

        // Export all option
        utils.createElement('div', { style: 'margin-bottom: 16px;' }, [
            utils.createElement('label', { style: 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--color-text);' }, [
                utils.createElement('input', { type: 'radio', name: 'export-type', value: 'all', checked: true, id: 'export-type-all' }),
                utils.createElement('span', { textContent: 'Export All Data' })
            ])
        ]),

        // Date range option
        utils.createElement('div', { style: 'margin-bottom: 16px;' }, [
            utils.createElement('label', { style: 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--color-text);' }, [
                utils.createElement('input', { type: 'radio', name: 'export-type', value: 'range', id: 'export-type-range' }),
                utils.createElement('span', { textContent: 'Select Date Range' })
            ])
        ]),

        // Date inputs container
        utils.createElement('div', { id: 'date-range-inputs', style: 'display: none; margin-bottom: 16px; padding: 12px; background: var(--color-background); border-radius: 8px;' }, [
            utils.createElement('div', { style: 'display: flex; gap: 12px;' }, [
                utils.createElement('div', { style: 'flex: 1;' }, [
                    utils.createElement('label', { textContent: 'From:', style: 'display: block; margin-bottom: 4px; font-size: 12px; color: var(--color-text-secondary);' }),
                    utils.createElement('input', { type: 'date', id: 'export-date-from', style: 'width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: 6px;' })
                ]),
                utils.createElement('div', { style: 'flex: 1;' }, [
                    utils.createElement('label', { textContent: 'To:', style: 'display: block; margin-bottom: 4px; font-size: 12px; color: var(--color-text-secondary);' }),
                    utils.createElement('input', { type: 'date', id: 'export-date-to', style: 'width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: 6px;' })
                ])
            ])
        ]),

        // Category filter option
        utils.createElement('div', { style: 'margin-bottom: 16px;' }, [
            utils.createElement('label', { style: 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--color-text);' }, [
                utils.createElement('input', { type: 'radio', name: 'export-type', value: 'category', id: 'export-type-category' }),
                utils.createElement('span', { textContent: 'Export by Category' })
            ])
        ]),

        // Category select container
        utils.createElement('div', { id: 'category-select-container', style: 'display: none; margin-bottom: 16px;' }, [
            utils.createElement('select', { id: 'export-category-select', style: 'width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-background);' })
        ]),

        // Buttons
        utils.createElement('div', { style: 'display: flex; gap: 12px; margin-top: 20px;' }, [
            utils.createElement('button', {
                textContent: 'Cancel',
                style: 'flex: 1; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; background: transparent; cursor: pointer; color: var(--color-text);',
                onClick: () => modal.remove()
            }),
            utils.createElement('button', {
                id: 'confirm-export-btn',
                textContent: 'Export PDF',
                style: 'flex: 1; padding: 12px; border: none; border-radius: 8px; background: var(--color-primary); color: white; cursor: pointer; font-weight: 600;',
                onClick: async () => {
                    const exportType = document.querySelector('input[name="export-type"]:checked')?.value;
                    modal.remove();

                    if (exportType === 'all') {
                        await exportToPDF(null, null, null);
                    } else if (exportType === 'range') {
                        const from = utils.$('#export-date-from').value;
                        const to = utils.$('#export-date-to').value;
                        await exportToPDF(from, to, null);
                    } else if (exportType === 'category') {
                        const categoryId = utils.$('#export-category-select').value;
                        await exportToPDF(null, null, categoryId);
                    }
                }
            })
        ])
    ]);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Populate categories
    api.getCategories().then(categories => {
        const select = utils.$('#export-category-select');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat._id;
            option.textContent = `${cat.icon} ${cat.name}`;
            select.appendChild(option);
        });
    });

    // Toggle date inputs visibility
    document.querySelectorAll('input[name="export-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const dateInputs = utils.$('#date-range-inputs');
            const catSelect = utils.$('#category-select-container');
            dateInputs.style.display = radio.value === 'range' ? 'block' : 'none';
            catSelect.style.display = radio.value === 'category' ? 'block' : 'none';
        });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

utils.$('#export-pdf-btn')?.addEventListener('click', showExportModal);
utils.$('#export-pdf-main')?.addEventListener('click', showExportModal);

async function exportToPDF(dateFrom = null, dateTo = null, categoryId = null) {
    utils.showToast('Generating report...', 'info');

    try {
        let filters = {};
        if (dateFrom) filters.dateFrom = new Date(dateFrom).toISOString();
        if (dateTo) filters.dateTo = new Date(dateTo).toISOString();
        if (categoryId) filters.categoryId = categoryId;
        if (appState.currentGroupId) filters.groupId = appState.currentGroupId;

        const expenses = await api.getExpenses(filters);
        const categories = await api.getCategories(appState.currentGroupId);

        if (expenses.length === 0) {
            utils.showToast('No expenses found for the selected criteria', 'warning');
            return;
        }

        // Create printable content
        const printWindow = window.open('', '_blank');
        const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        let tableRows = expenses.map(exp => {
            const cat = typeof exp.categoryId === 'object' ? exp.categoryId : categories.find(c => c._id === exp.categoryId);
            const date = exp.dateEthiopian || new Date(exp.date).toLocaleDateString();
            return `<tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${exp.reason}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${cat?.icon || ''} ${cat?.name || 'Other'}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${utils.formatCurrency(exp.amount)} ETB</td>
            </tr>`;
        }).join('');

        const filterInfo = categoryId
            ? `Filtered by Category: ${categories.find(c => c._id === categoryId)?.name || 'Unknown'}`
            : dateFrom || dateTo
                ? `Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}`
                : 'All Expenses';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Expense Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; margin-bottom: 5px; }
                    .subtitle { color: #666; margin-bottom: 5px; }
                    .filter-info { color: #888; font-size: 12px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background: #333; color: white; padding: 10px; text-align: left; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .total-row { font-weight: bold; background: #eee !important; }
                    .total-row td { border-top: 2px solid #333; }
                </style>
            </head>
            <body>
                <h1>Expense Report</h1>
                <p class="subtitle">Generated on ${new Date().toLocaleDateString()}</p>
                <p class="filter-info">${filterInfo}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Reason</th>
                            <th>Category</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="total-row">
                            <td colspan="3" style="padding: 10px; border: 1px solid #ddd;"><strong>Total</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>${utils.formatCurrency(totalAmount)} ETB</strong></td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        utils.showToast('Report generated successfully!', 'success');
    } catch (e) {
        utils.showToast('Failed to generate report', 'error');
    }
}

// ===================================
// Export app functions
// ===================================
window.app = {
    showPage,
    showToast: utils.showToast,
    showModal: utils.showModal,
    hideModal: utils.hideModal,
    openDatePicker,
    addNotification,
    renderNotifications
};

// ===================================
// Initialization
// ===================================

// ===================================
// Group / Shared Expense Logic
// ===================================

async function initGroups() {
    if (!appState.isLoggedIn) return;
    try {
        const groups = await api.getMyGroups();
        appState.groups = groups || [];
        updateHomeContextUI();
    } catch (e) {
        console.error('Failed to load groups:', e);
    }
}

function renderGroupsSettings() {
    const listContainer = utils.$('#shared-groups-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Always show the user's persistent connection ID first
    let myConnectionId = localStorage.getItem('myConnectionId');
    if (!myConnectionId) {
        myConnectionId = 'CONN-' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('myConnectionId', myConnectionId);
    }

    // My Connection ID Card
    const myIdCard = utils.createElement('div', {
        className: 'category-card',
        style: 'padding: 12px; margin-bottom: 12px; background: var(--color-primary-gradient);'
    }, [
        utils.createElement('p', {
            textContent: 'Your Connection ID',
            style: 'margin: 0 0 4px 0; font-size: 0.7rem; opacity: 0.8; color: white;'
        }),
        utils.createElement('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
            utils.createElement('span', {
                textContent: myConnectionId,
                style: 'font-size: 1rem; font-weight: bold; color: white; flex: 1;'
            }),
            utils.createElement('button', {
                className: 'btn',
                innerHTML: '📋',
                style: 'padding: 6px 10px; background: rgba(255,255,255,0.2); color: white; border: none;',
                onClick: () => {
                    navigator.clipboard.writeText(myConnectionId);
                    utils.showToast('ID copied!', 'success');
                }
            })
        ])
    ]);
    listContainer.appendChild(myIdCard);

    if (!appState.groups || appState.groups.length === 0) {
        listContainer.innerHTML += `
            <div class="empty-state" style="padding: 10px; text-align: left;">
                <p style="font-size: 0.8rem;">No shared connections yet. Tap below to connect.</p>
            </div>
        `;
    } else {
        appState.groups.forEach(group => {
            const item = utils.createElement('div', {
                className: 'category-card',
                style: 'padding: 12px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;',
                onClick: () => openGroupDetails(group)
            }, [
                utils.createElement('div', {}, [
                    utils.createElement('h4', { textContent: group.name, style: 'margin: 0; font-size: 0.9rem;' }),
                    utils.createElement('p', { textContent: `ID: ${group.connectionId}`, style: 'margin: 0; font-size: 0.7rem; opacity: 0.7;' })
                ]),
                utils.createElement('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
                    utils.createElement('span', { textContent: 'Manage', style: 'color: var(--color-primary); font-size: 0.7rem; margin-right: 5px;' }),
                    utils.createElement('span', { textContent: 'Active', style: 'color: var(--color-success); font-size: 0.7rem;' }),
                    utils.createElement('button', {
                        className: 'category-action-btn delete-btn',
                        innerHTML: '🗑️',
                        onClick: async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to leave/delete "${group.name}"?`)) {
                                try {
                                    await api.deleteGroup(group._id);
                                    utils.showToast('Removed from group', 'success');
                                    await initGroups();
                                    renderGroupsSettings();
                                    if (appState.currentGroupId === group._id) {
                                        appState.currentGroupId = null;
                                        localStorage.removeItem('currentGroupId');
                                        updateHomeContextUI();
                                    }
                                } catch (err) {
                                    utils.showToast(err.message, 'error');
                                }
                            }
                        }
                    })
                ])
            ]);
            listContainer.appendChild(item);
        });
    }

    const connectBtn = utils.$('#connect-group-btn');
    if (connectBtn) {
        connectBtn.onclick = showConnectGroupModal;
    }
}

async function openGroupDetails(group) {
    const content = utils.createElement('div', { style: 'padding-bottom: 20px;' }, [
        utils.createElement('div', { className: 'modal-header' }, [
            utils.createElement('h3', { textContent: `Manage ${group.name}` }),
            utils.createElement('button', { className: 'modal-close', textContent: '×', onClick: () => utils.hideModal('group-details-modal') })
        ]),
        utils.createElement('div', { style: 'margin-bottom: 20px;' }, [
            utils.createElement('h4', { textContent: 'Shared Categories', style: 'margin-bottom: 10px;' }),
            utils.createElement('div', { id: `group-cats-${group._id}`, className: 'categories-grid', style: 'grid-template-columns: 1fr;' }),
            utils.createElement('button', {
                className: 'btn btn-outline btn-full',
                textContent: '+ Add Shared Category',
                style: 'margin-top: 10px;',
                onClick: () => {
                    // Open category creation specifically for this group
                    // Since we are in a modal, maybe replace content or stack?
                    // Let's use the existing "Add Category" modal but pass the group ID
                    // Need to adapt handleAddCategory to accept context or set global?

                    // We can set a temporary state or pass params to showAddCategoryModal if we had one.
                    // Currently handleAddCategory uses inputs from the settings page.
                    // Let's create a specialized small form inside here or reuse logic.
                    showAddSharedCategoryForm(group);
                }
            })
        ])
    ]);

    utils.showModal(content, 'group-details-modal');

    // Load categories for this group
    const container = document.getElementById(`group-cats-${group._id}`);
    if (container) {
        container.innerHTML = '<p>Loading...</p>';
        try {
            const categories = await api.getCategories(group._id);
            container.innerHTML = '';
            if (categories.length === 0) {
                container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted);">No shared categories yet.</p>';
            } else {
                categories.forEach(cat => {
                    const row = utils.createElement('div', {
                        className: 'category-card',
                        style: 'display: flex; align-items: center; padding: 10px; margin-bottom: 5px; cursor: pointer;',
                        onClick: () => showEditSharedCategoryForm(group, cat)
                    }, [
                        utils.createElement('span', { textContent: cat.icon, style: 'font-size: 1.2rem; margin-right: 10px;' }),
                        utils.createElement('div', { style: 'flex: 1;' }, [
                            utils.createElement('span', { textContent: cat.name, style: 'font-weight: 500;' })
                        ]),
                        utils.createElement('span', { textContent: '✏️', style: 'font-size: 0.9rem; opacity: 0.7;' })
                    ]);
                    container.appendChild(row);
                });
            }
        } catch (e) {
            container.innerHTML = '<p>Error loading categories.</p>';
        }
    }
}

// Helper to open edit form for shared category
function showEditSharedCategoryForm(group, category) {
    const content = utils.createElement('div', { style: 'padding-bottom: 20px;' }, [
        utils.createElement('div', { className: 'modal-header' }, [
            utils.createElement('h3', { textContent: `Edit Category` }),
            utils.createElement('button', { className: 'modal-close', textContent: '×', onClick: () => utils.hideModal('edit-shared-cat-modal') })
        ]),
        utils.createElement('div', { style: 'margin-bottom: 15px;' }, [
            utils.createElement('label', { textContent: 'Name', style: 'display:block; margin-bottom:5px; font-size:0.9rem;' }),
            utils.createElement('input', { id: 'edit-shared-cat-name', type: 'text', value: category.name, className: 'date-input', style: 'width: 100%;' })
        ]),
        utils.createElement('div', { style: 'margin-bottom: 20px;' }, [
            utils.createElement('label', { textContent: 'Icon', style: 'display:block; margin-bottom:5px; font-size:0.9rem;' }),
            utils.createElement('input', { id: 'edit-shared-cat-icon', type: 'text', value: category.icon, className: 'date-input', style: 'width: 100%;' }),
            utils.createElement('div', { className: 'emoji-quick-select', style: 'margin-top: 8px; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;' },
                ['🏠', '🍔', '🚗', '💊', '🎉', '✈️', '💡', '🛒', '💰', '🎬', '📱', '🏋️'].map(i => {
                    return utils.createElement('span', {
                        textContent: i,
                        style: 'cursor: pointer; font-size: 1.2rem; padding: 4px; border-radius: 4px; background: rgba(255,255,255,0.05);',
                        onClick: () => document.getElementById('edit-shared-cat-icon').value = i
                    });
                })
            )
        ]),
        utils.createElement('button', {
            className: 'btn btn-primary btn-full',
            textContent: 'Save Changes',
            onClick: async () => {
                const name = document.getElementById('edit-shared-cat-name').value;
                const icon = document.getElementById('edit-shared-cat-icon').value;
                if (!name || !icon) return utils.showToast('Fill all fields', 'error');

                try {
                    await api.updateCategory(category._id, { name, icon });
                    utils.showToast('Category updated!', 'success');
                    utils.hideModal('edit-shared-cat-modal');
                    openGroupDetails(group);
                } catch (e) {
                    utils.showToast(e.message, 'error');
                }
            }
        })
    ]);
    utils.showModal(content, 'edit-shared-cat-modal');
}

function showAddSharedCategoryForm(group) {
    const content = utils.createElement('div', { style: 'padding-bottom: 20px;' }, [
        utils.createElement('div', { className: 'modal-header' }, [
            utils.createElement('h3', { textContent: `Add Category to ${group.name}` }),
            utils.createElement('button', { className: 'modal-close', textContent: '×', onClick: () => utils.hideModal('add-shared-cat-modal') })
        ]),
        utils.createElement('div', { style: 'margin-bottom: 15px;' }, [
            utils.createElement('label', { textContent: 'Name', style: 'display:block; margin-bottom:5px; font-size:0.9rem;' }),
            utils.createElement('input', { id: 'shared-cat-name', type: 'text', placeholder: 'e.g. Groceries', className: 'date-input', style: 'width: 100%;' })
        ]),
        utils.createElement('div', { style: 'margin-bottom: 20px;' }, [
            utils.createElement('label', { textContent: 'Icon', style: 'display:block; margin-bottom:5px; font-size:0.9rem;' }),
            utils.createElement('input', { id: 'shared-cat-icon', type: 'text', placeholder: 'Select or type emoji', className: 'date-input', style: 'width: 100%;' }),
            utils.createElement('div', { className: 'emoji-quick-select', style: 'margin-top: 8px; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;' },
                ['🏠', '🍔', '🚗', '💊', '🎉', '✈️', '💡', '🛒', '💰', '🎬', '📱', '🏋️'].map(i => {
                    return utils.createElement('span', {
                        textContent: i,
                        style: 'cursor: pointer; font-size: 1.2rem; padding: 4px; border-radius: 4px; background: rgba(255,255,255,0.05);',
                        onClick: () => document.getElementById('shared-cat-icon').value = i
                    });
                })
            )
        ]),
        utils.createElement('button', {
            className: 'btn btn-primary btn-full',
            textContent: 'Save Category',
            onClick: async () => {
                const name = document.getElementById('shared-cat-name').value;
                const icon = document.getElementById('shared-cat-icon').value;
                if (!name || !icon) return utils.showToast('Fill all fields', 'error');

                try {
                    await api.createCategory({ name, icon, groupId: group._id });
                    utils.showToast('Shared category added!', 'success');
                    utils.hideModal('add-shared-cat-modal');
                    openGroupDetails(group);
                } catch (e) {
                    utils.showToast(e.message, 'error');
                }
            }
        })
    ]);
    utils.showModal(content, 'add-shared-cat-modal');
}


function showConnectGroupModal() {
    // Create Modal Content
    const content = utils.createElement('div', { style: 'padding-bottom: 20px;' }, [
        utils.createElement('div', { className: 'modal-header' }, [
            utils.createElement('h3', { textContent: 'Connect Partner' }),
            utils.createElement('button', { className: 'modal-close', textContent: '×', onClick: () => utils.hideModal('dynamic-modal') })
        ]),
        utils.createElement('div', { className: 'tabs', style: 'display: flex; gap: 10px; margin-bottom: 20px;' }, [
            utils.createElement('button', {
                className: 'btn btn-primary',
                textContent: 'Join Existing',
                style: 'flex: 1; font-size: 0.8rem;',
                id: 'tab-join',
                onClick: (e) => switchModalTab(e, 'join')
            }),
            utils.createElement('button', {
                className: 'btn btn-outline',
                textContent: 'Create New',
                style: 'flex: 1; font-size: 0.8rem;',
                id: 'tab-create',
                onClick: (e) => switchModalTab(e, 'create')
            })
        ]),
        // Form Container
        utils.createElement('div', { id: 'modal-form-container' })
    ]);

    utils.showModal(content);
    // Initial render
    renderJoinForm();
}

function switchModalTab(e, tab) {
    const btns = document.querySelectorAll('.tabs button');
    btns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
    });
    e.target.classList.remove('btn-outline');
    e.target.classList.add('btn-primary');

    if (tab === 'join') renderJoinForm();
    else renderCreateForm();
}

function renderJoinForm() {
    const container = utils.$('#modal-form-container');
    container.innerHTML = '';

    container.appendChild(utils.createElement('p', { textContent: 'Enter the details shared by your partner.', style: 'font-size: 0.8rem; margin-bottom: 15px; opacity: 0.7;' }));

    const phoneInput = utils.createElement('input', { type: 'tel', placeholder: 'Partner Phone Number', className: 'date-input', style: 'width: 100%; margin-bottom: 10px;' });
    const idInput = utils.createElement('input', { type: 'text', placeholder: 'Connection ID (e.g., CONN-1234)', className: 'date-input', style: 'width: 100%; margin-bottom: 20px;' });

    const submitBtn = utils.createElement('button', { className: 'btn btn-primary btn-full', textContent: 'Connect' });

    submitBtn.onclick = async function handleAddCategory() {
        const name = nameInput.value.trim();
        const icon = iconInput.value.trim();

        if (!name || !icon) return utils.showToast('Name and icon required', 'error');

        try {
            submitBtn.textContent = 'Saving...';
            // Passing groupId if present (for shared categories)
            await api.createCategory({
                name,
                icon,
                groupId: appState.currentGroupId || undefined
            });

            utils.showToast('Category added', 'success');
            utils.hideModal('dynamic-modal');
            renderCategoriesSettings();

            // Also refresh home if we are there
            if (appState.currentPage === 'home') renderHome();
        } catch (e) {
            utils.showToast(e.message, 'error');
            submitBtn.textContent = 'Save Category';
        }
    };

    container.append(phoneInput, idInput, submitBtn);
}

function renderCreateForm() {
    const container = utils.$('#modal-form-container');
    container.innerHTML = '';

    // Get or create persistent connection ID for this user
    let connectionId = localStorage.getItem('myConnectionId');
    if (!connectionId) {
        connectionId = 'CONN-' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('myConnectionId', connectionId);
    }

    container.appendChild(utils.createElement('p', { textContent: 'Create a shared space. Share this ID with your partner.', style: 'font-size: 0.8rem; margin-bottom: 15px; opacity: 0.7;' }));

    const nameInput = utils.createElement('input', { type: 'text', placeholder: 'Group Name (e.g., Home, Business)', className: 'date-input', style: 'width: 100%; margin-bottom: 10px;' });

    // ID display row with regenerate button
    const idRow = utils.createElement('div', { style: 'display: flex; gap: 8px; margin-bottom: 10px;' });
    const idInput = utils.createElement('input', { type: 'text', value: connectionId, readOnly: true, className: 'date-input', style: 'flex: 1; background: var(--color-surface-elevated);' });
    const regenerateBtn = utils.createElement('button', {
        className: 'btn btn-outline',
        innerHTML: '🔄',
        title: 'Generate New ID',
        style: 'padding: 10px 14px;',
        onClick: () => {
            const newId = 'CONN-' + Math.floor(1000 + Math.random() * 9000);
            localStorage.setItem('myConnectionId', newId);
            idInput.value = newId;
            utils.showToast('New ID generated!', 'success');
        }
    });
    idRow.append(idInput, regenerateBtn);

    // Copy button
    const copyBtn = utils.createElement('button', {
        className: 'btn btn-outline btn-full',
        textContent: '📋 Copy Connection ID',
        style: 'margin-bottom: 20px;',
        onClick: () => {
            navigator.clipboard.writeText(idInput.value);
            utils.showToast('Copied to clipboard!', 'success');
        }
    });

    const submitBtn = utils.createElement('button', { className: 'btn btn-primary btn-full', textContent: 'Create Connection' });

    submitBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) return utils.showToast('Please enter a name', 'error');

        try {
            submitBtn.textContent = 'Creating...';
            if (typeof api.createGroup !== 'function') throw new Error('API Create function missing');
            await api.createGroup({ name, connectionId: idInput.value });
            utils.showToast('Group created! Share the ID with your partner.', 'success');
            await initGroups();
            renderGroupsSettings();
            utils.hideModal('dynamic-modal');
        } catch (e) {
            utils.showToast(e.message, 'error');
            submitBtn.textContent = 'Create Connection';
        }
    };

    container.append(nameInput, idRow, copyBtn, submitBtn);
}

// Global Swipe State
// Global Swipe State
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function handleSwipe() {
    const SWIPE_THRESHOLD = 50;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Only trigger if horizontal movement is significantly greater than vertical movement
    // This prevents triggering swipe while scrolling down
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            if (diffX < 0) {
                // Swiped Left -> Next Context
                switchContext('next');
            } else {
                // Swiped Right -> Prev Context
                switchContext('prev');
            }
        }
    }
}

function switchContext(direction) {
    if (!appState.groups || appState.groups.length === 0) return; // No groups to switch to

    /* 
       Contexts:
       0: Personal (currentGroupId: null)
       1..N: Groups (currentGroupId: appState.groups[i-1]._id)
    */

    const allContexts = [null, ...appState.groups.map(g => g._id)];
    const currentIndex = allContexts.indexOf(appState.currentGroupId);
    let nextIndex;

    if (direction === 'next') {
        nextIndex = (currentIndex + 1) % allContexts.length;
    } else {
        nextIndex = (currentIndex - 1 + allContexts.length) % allContexts.length;
    }

    if (nextIndex === currentIndex) return;

    // Animate
    const container = utils.$('#home-context-container');
    const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction === 'next' ? 'slide-in-right' : 'slide-in-left';

    if (container) {
        container.classList.add(outClass);

        // Wait for animation
        setTimeout(async () => {
            // Update State
            appState.currentGroupId = allContexts[nextIndex];
            // Persist Choice
            if (appState.currentGroupId) {
                localStorage.setItem('currentGroupId', appState.currentGroupId);
            } else {
                localStorage.removeItem('currentGroupId');
            }

            // Update UI
            updateHomeContextUI();

            // Re-render Data
            // We need to fetch invalidating current expense list?
            // api.getExpenses will filter by valid group
            // We just call renderHome/renderRecentExpenses
            await renderHome();

            // Reset and Animate In
            container.classList.remove(outClass);
            container.classList.add(inClass);
            setTimeout(() => container.classList.remove(inClass), 300);
        }, 200);
    }
}

function updateHomeContextUI() {
    const headerSection = utils.$('#context-header-section');
    const label = utils.$('#current-context-label');
    const dotsContainer = utils.$('.context-indicator-wrapper');

    if (!appState.groups || appState.groups.length === 0) {
        if (headerSection) headerSection.style.display = 'none';
        return;
    }

    if (headerSection) headerSection.style.display = 'block';

    const allContexts = [null, ...appState.groups.map(g => g._id)]; // null = Personal
    // Ensure currentGroupId is valid
    if (appState.currentGroupId && !allContexts.includes(appState.currentGroupId)) {
        appState.currentGroupId = null;
    }

    const currentIndex = allContexts.indexOf(appState.currentGroupId);

    // Label
    if (appState.currentGroupId === null) {
        if (label) label.textContent = 'Personal Expenses';
    } else {
        const group = appState.groups.find(g => g._id === appState.currentGroupId);
        if (label) label.textContent = group ? group.name : 'Shared Group';
    }

    // Dots
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        allContexts.forEach((_, i) => {
            const dot = utils.createElement('span', { className: `context-dot ${i === currentIndex ? 'active' : ''}` });
            dotsContainer.appendChild(dot);
        });
    }
}

async function initApp() {
    // Check for existing session
    const user = localStorage.getItem('currentUser');
    const token = localStorage.getItem('token');

    if (user && token) {
        appState.isLoggedIn = true;
        await initGroups();
    }

    // Immediately hide splash and show login
    setTimeout(() => {
        hideSplashScreen();
    }, 1000); // Reduced to 1 second

    // Initialize components
    initNavigation();
    initAuth();
    initHome();
    initAddExpense();
    initReport();
    initSettings();
    initCategoryPage();
    initModals();
    initCharts();

    // Initialize i18n
    const savedLang = localStorage.getItem('language') || 'en';
    if (window.i18n) {
        window.i18n.setLanguage(savedLang);
        const langSelector = utils.$('#language-selector');
        if (langSelector) langSelector.value = savedLang;
    }

    updateNotificationBadge();

    // Apply saved theme settings without auto-login
    const savedUser = utils.loadFromStorage('currentUser');
    if (savedUser && savedUser.settings) {
        document.documentElement.dataset.theme = savedUser.settings.darkMode ? 'dark' : 'light';
        document.documentElement.dataset.fontSize = savedUser.settings.fontSize || 'medium';
    }

    // Main App Init
    // Always show login to satisfy "no automatic login" + "password needed every time"
    if (appState.isLoggedIn) {
        // Technically we are "logged in" by token, but we want to force re-entry
        // So we keep valid data but show login screen
    }
    showPage('login', false);

    // Background sync if online
    if (navigator.onLine && appState.isLoggedIn) {
        api.syncPendingData().catch(console.error);
    }

    // Network status listeners
    utils.addNetworkListeners(
        () => {
            utils.showToast('You are back online!', 'success');
            // Use updated sync name
            if (api.syncPendingData) api.syncPendingData().then(() => {
                if (appState.currentPage === 'home') renderHome();
            });
        },
        () => utils.showToast('You are offline. Changes will sync when online.', 'warning')
    );

    // Service Worker messages
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', async (event) => {
            if (event.data.type === 'TRIGGER_SYNC') {
                console.log('Background sync triggered from Service Worker');
                if (api.syncPendingData) {
                    await api.syncPendingData();
                    if (appState.currentPage === 'home') renderHome();
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});

/* ===================================
   PWA Install Promotion
   =================================== */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Show install button
    showInstallButton();
});

function showInstallButton() {
    // Try to find a place in Settings
    // We check if utility is available, otherwise waiting for DOM might be needed
    // But since this event usually fires slightly after load, DOM should be ready or initApp renders it

    // We target the Settings page logout button container
    // We perform a check to ensure we don't add duplicate buttons
    if (document.getElementById('pwa-install-btn')) return;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn && deferredPrompt) {
        const installBtn = document.createElement('button');
        installBtn.id = 'pwa-install-btn';
        installBtn.className = 'btn btn-primary btn-full';
        installBtn.style.marginBottom = '16px';
        installBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)'; // Distinct Green
        installBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;margin-right:8px;vertical-align:middle;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Install App
        `;

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            if (outcome === 'accepted') {
                deferredPrompt = null;
                installBtn.remove();
            }
        });

        logoutBtn.parentNode.insertBefore(installBtn, logoutBtn);
    }
}
