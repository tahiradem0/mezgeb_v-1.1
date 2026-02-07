/* ===================================
   EXPENSE TRACKER - API Service
   =================================== */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://mezgeb-v-1-1.onrender.com/api';

// Initialize Dexie (IndexedDB)
const db = new Dexie('MezgebDB');
db.version(3).stores({
    // Use _id as the primary key since it's unique from MongoDB or generated for pending
    expenses: '_id, categoryId, amount, reason, date, status, groupId',
    categories: '_id, name, icon'
}).upgrade(tx => {
    return tx.expenses.clear();
});

const api = {
    db,
    // ... (request method stays same) ...
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 204) return null;

            if (response.status === 401) {
                console.warn('Session expired or invalid. Logging out.');
                localStorage.removeItem('token');
                localStorage.removeItem('currentUser');
                window.location.reload();
                throw new Error('Please authenticate.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            if (endpoint.startsWith('/expenses')) {
                if (!options.method || options.method === 'GET') {
                    // Logic: If fetching all (no query or just groupId), replace local cache.
                    // But if fetching specific filters, maybe not replace all.
                    // For simplicity, we stick to replacing 'synced' expenses logic cautiously.
                    // If groupId is present, we might want to store them differently?
                    // Dexie 'status' field helps separating pending vs synced.
                    // We can just add them.

                    // Note: This logic wipes ALL synced expenses. 
                    // If we fetch Group A expenses, we don't want to wipe Personal expenses.
                    // We should only delete synced expenses matching the context.

                    let collection = db.expenses.where({ status: 'synced' });
                    // parsing query params from endpoint is hard here without URL object
                    // simpler: just bulkPut (upsert) instead of delete-then-add
                    await db.expenses.bulkPut(data.map(e => ({ ...e, status: 'synced' })));
                } else if (options.method === 'PATCH') {
                    await db.expenses.update(data._id, { ...data, status: 'synced' });
                } else if (options.method === 'DELETE') {
                    const id = endpoint.split('/').pop();
                    await db.expenses.delete(id);
                }
            } else if (endpoint.startsWith('/categories')) {
                if (!options.method || options.method === 'GET') {
                    await db.categories.clear();
                    await db.categories.bulkAdd(data);
                }
            }

            return data;
        } catch (error) {
            if (!navigator.onLine || error.name === 'TypeError') {
                return this.handleOfflineRequest(endpoint, options);
            }
            throw error;
        }
    },

    async handleOfflineRequest(endpoint, options) {
        // GET Expenses
        if (endpoint.startsWith('/expenses') && (!options.method || options.method === 'GET')) {
            // Parse filters roughly
            const urlObj = new URL('http://dummy' + endpoint);
            const groupId = urlObj.searchParams.get('groupId');

            let collection = db.expenses.toCollection();
            if (groupId) {
                collection = db.expenses.where('groupId').equals(groupId);
            } else {
                // Personal: groupId is null or undefined
                // Dexie doesn't query null easily with "equals" sometimes?
                // Filter normally
                collection = db.expenses.filter(e => !e.groupId);
            }

            return collection.toArray();
        }

        // GET Categories
        if (endpoint.startsWith('/categories') && (!options.method || options.method === 'GET')) {
            const cats = await db.categories.toArray();
            if (cats.length > 0) return cats;
            return [];
        }
        // POST Expense
        if (endpoint === '/expenses' && options.method === 'POST') {
            const expenseData = JSON.parse(options.body);
            const offlineExpense = {
                ...expenseData,
                _id: 'pending_' + Date.now(),
                status: 'pending'
            };
            await db.expenses.add(offlineExpense);
            this.registerSync();
            return offlineExpense;
        }

        // ...
        if (endpoint.startsWith('/categories')) return db.categories.toArray(); // Fallback

        if (endpoint.startsWith('/groups')) return []; // Basic offline support for groups

        throw new Error('Offline: Action not supported.');
    },

    async registerSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const reg = await navigator.serviceWorker.ready;
                await reg.sync.register('sync-data');
            } catch (e) {
                console.error('Background sync registration failed:', e);
            }
        }
    },

    // Sync pending data (categories and expenses)
    async syncPendingData() {
        if (!navigator.onLine) return;

        // 1. Sync Categories First
        const pendingCats = await db.categories.where({ status: 'pending' }).toArray();
        for (const cat of pendingCats) {
            try {
                const { _id, status, ...cleanData } = cat;
                const response = await fetch(`${API_BASE_URL}/categories`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(cleanData)
                });

                if (response.ok) {
                    const savedCat = await response.json();
                    await db.categories.delete(cat._id);
                    await db.categories.add(savedCat);
                }
            } catch (e) { console.error('Failed to sync category:', cat, e); }
        }

        // 2. Sync Expenses
        const pendingExpenses = await db.expenses.where({ status: 'pending' }).toArray();
        for (const exp of pendingExpenses) {
            try {
                const { _id, status, ...cleanData } = exp;
                const response = await fetch(`${API_BASE_URL}/expenses`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(cleanData)
                });

                if (response.ok) {
                    const savedExpense = await response.json();
                    await db.expenses.delete(exp._id);
                    await db.expenses.add({ ...savedExpense, status: 'synced' });
                }
            } catch (e) {
                console.error('Failed to sync expense:', exp, e);
            }
        }
    },

    // Auth
    async login(credentials) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return data;
    },

    async register(userData) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return data;
    },

    async getProfile() {
        return this.request('/auth/me');
    },

    async updateSettings(settings) {
        const data = await this.request('/auth/settings', {
            method: 'PATCH',
            body: JSON.stringify(settings)
        });
        localStorage.setItem('currentUser', JSON.stringify(data));
        return data;
    },

    // Categories
    async getCategories() {
        return this.request('/categories');
    },

    async createCategory(categoryData) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    },

    async updateCategory(id, categoryData) {
        return this.request(`/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(categoryData)
        });
    },

    // Groups
    async createGroup(groupData) {
        return this.request('/groups/create', {
            method: 'POST',
            body: JSON.stringify(groupData)
        });
    },

    async joinGroup(joinData) {
        return this.request('/groups/join', {
            method: 'POST',
            body: JSON.stringify(joinData)
        });
    },

    async getMyGroups() {
        return this.request('/groups');
    },

    // Expenses (existing)
    async getExpenses(filters = {}) {
        const cleanFilters = {};
        for (const key in filters) {
            if (filters[key] !== undefined && filters[key] !== null && filters[key] !== 'undefined') {
                cleanFilters[key] = filters[key];
            }
        }
        const query = new URLSearchParams(cleanFilters).toString();
        return this.request(`/expenses?${query}`);
    },

    async createExpense(expenseData) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(expenseData)
        });
    },

    async updateExpense(id, expenseData) {
        return this.request(`/expenses/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(expenseData)
        });
    },

    async deleteExpense(id) {
        return this.request(`/expenses/${id}`, {
            method: 'DELETE'
        });
    }
};

window.api = api;
