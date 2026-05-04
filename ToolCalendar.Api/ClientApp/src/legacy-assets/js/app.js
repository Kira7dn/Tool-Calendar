import { createApi } from './core/api.js';
import { createI18nService } from './core/i18n.js';
import { createUiFeature } from './features/ui.js';
import { createSessionFeature } from './features/session.js';
import { createNotificationsFeature } from './features/notifications.js';
import { createPdfFeature } from './features/pdf.js';
import { createDashboardFeature } from './features/dashboard.js';
import { createDocumentsFeature } from './features/documents.js';
import { createDocDetailFeature } from './features/docDetail.js';
import { createUploadFeature } from './features/upload.js';
import { createReviewFeature } from './features/review.js';
import { createUsersFeature } from './features/users.js';
import { createMyTasksFeature } from './features/myTasks.js';
import { createSettingsFeature } from './features/settings.js';
import { createAdminMetaFeature } from './features/adminMeta.js';

let currentTab = 'dashboard';
let initialized = false;
let sessionFeature;
let notificationsFeature;
let i18nService;
let features = {};

function applyRoleRestrictions(role) {
    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.style.display = (role === 'Admin') ? 'flex' : 'none';

    const navMyTasks = document.getElementById('nav-my-tasks');
    if (navMyTasks) navMyTasks.style.display = (role === 'CanBo' || role === 'VanThu') ? 'flex' : 'none';

    if (role !== 'Admin' && role !== 'VanThu') {
        const uploadBtn = document.querySelector('.header-actions .btn-primary');
        if (uploadBtn) uploadBtn.style.display = 'none';

        const uploadTab = document.querySelector('[data-tab="upload"]');
        if (uploadTab) uploadTab.style.display = 'none';

        if (role !== 'Admin') {
            const settingsTab = document.querySelector('[data-tab="settings"]');
            if (settingsTab) settingsTab.style.display = 'none';
        }
    }
}

function restoreSidebarState() {
    if (localStorage.getItem('sidebar_collapsed') === '1') {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
}

function activateTab(tabId) {
    if (tabId === 'users') return features.users.activate();
    if (tabId === 'settings') return features.settings.activate();
    if (tabId === 'my-tasks') return features.myTasks.activate();
    if (tabId === 'dashboard') return features.dashboard.activate();
    if (tabId === 'documents') return features.documents.activate();
    if (tabId === 'upload') return features.upload.activate();
    return Promise.resolve();
}

export function initializeApp() {
    if (initialized) return;

    i18nService = createI18nService();
    const ui = createUiFeature();
    sessionFeature = createSessionFeature();
    const api = createApi({ onUnauthorized: () => sessionFeature.logout() });

    const context = {
        api,
        ui,
        i18n: i18nService,
        shell: {
            showTab,
            openSidebar,
            closeSidebar,
            toggleSidebar,
            logout: (...args) => sessionFeature.logout(...args)
        },
        services: {}
    };

    const pdf = createPdfFeature(context);
    const dashboard = createDashboardFeature(context);
    const documents = createDocumentsFeature(context);
    const docDetail = createDocDetailFeature(context);
    const upload = createUploadFeature(context);
    const review = createReviewFeature(context);
    const users = createUsersFeature(context);
    const myTasks = createMyTasksFeature(context);
    const adminMeta = createAdminMetaFeature(context);
    const settings = createSettingsFeature(context);
    notificationsFeature = createNotificationsFeature(context);

    context.services = {
        pdf,
        upload,
        adminMeta,
        openPdfPreview: (...args) => pdf.openPreview(...args),
        openDocDetail: (...args) => docDetail.open(...args),
        enterReviewScene: (...args) => review.enterReviewScene(...args),
        refreshCoreData: async () => {
            await dashboard.refresh();
            await documents.refresh();
        }
    };

    features = {
        ui,
        session: sessionFeature,
        notifications: notificationsFeature,
        pdf,
        dashboard,
        documents,
        docDetail,
        upload,
        review,
        users,
        myTasks,
        settings,
        adminMeta
    };

    Object.values(features).forEach((feature) => {
        feature.init?.();
    });

    const username = localStorage.getItem('user_name') || 'User';
    const role = localStorage.getItem('user_role') || 'CanBo';
    const pillName = document.querySelector('.user-pill-name');
    if (pillName) pillName.innerText = `${username} (${role})`;

    applyRoleRestrictions(role);
    restoreSidebarState();

    context.services.refreshCoreData();
    settings.prefetch();
    showTab('dashboard');
    document.body.classList.remove('app-booting');

    translatePage();
    updateLangSwitcherUI();

    if (window.lucide) {
        window.lucide.createIcons();
    }

    console.log('Initializing language link listeners...');
    const langLinks = document.querySelectorAll('.lang-link');
    langLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const lang = link.dataset.lang;
            console.log('Language link clicked:', lang);
            changeLanguage(lang);
        };
    });

    document.addEventListener('click', async (event) => {
        const action = event.target.closest('[data-action]');
        if (!action) return;

        if (action.dataset.action === 'open-change-password-modal') {
            document.getElementById('change-password-modal').style.display = 'flex';

            ['current-user-new-password', 'current-user-confirm-password'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.type = 'password';
                    const toggle = input.nextElementSibling;
                    if (toggle && toggle.tagName === 'SPAN') {
                        toggle.innerText = '👁️';
                        toggle.title = 'Hiện mật khẩu';
                    }
                }
            });
        }

        if (action.dataset.action === 'close-change-password-modal') {
            document.getElementById('change-password-modal').style.display = 'none';
        }

        if (action.dataset.action === 'confirm-change-password') {
            const newPass = document.getElementById('current-user-new-password').value;
            const confirmPass = document.getElementById('current-user-confirm-password').value;

            if (!newPass || newPass.length < 4) {
                ui.showAlert(i18nService.t('error_password_length'), '⚠️');
                return;
            }

            if (newPass !== confirmPass) {
                ui.showAlert(i18nService.t('error_password_mismatch'), '❌');
                return;
            }

            try {
                const response = await api.post('/api/auth/change-password', {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword: newPass })
                });

                if (response.ok) {
                    ui.showAlert(i18nService.t('success_password_changed'), '✅');
                    document.getElementById('change-password-modal').style.display = 'none';
                    document.getElementById('current-user-new-password').value = '';
                    document.getElementById('current-user-confirm-password').value = '';
                } else {
                    const err = await response.json();
                    ui.showAlert(err.message || i18nService.t('error_saving'), '❌');
                }
            } catch (error) {
                ui.showAlert(i18nService.t('error_connection'), '📡');
            }
        }
    });

    initialized = true;
}

export async function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach((tab) => {
        tab.classList.remove('active-tab');
        tab.style.display = 'none';
    });

    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.add('active-tab');
        target.style.display = '';
    }

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (features.review) features.review.exitReviewScene();

    const docDetailPage = document.getElementById('doc-detail-page');
    if (docDetailPage) {
        docDetailPage.style.transform = 'translateX(100%)';
        setTimeout(() => { docDetailPage.style.display = 'none'; }, 320);
    }

    currentTab = tabId;
    await activateTab(tabId);
    translatePage();
    closeSidebar();

    const appName = i18nService.t('app_name');
    const tabName = i18nService.t(tabId);
    document.title = `${appName} | ${tabName}`;
}

export function openSidebar() {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}

export function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

export function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;

    if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    } else {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    }
}

export function logout(kicked = false) {
    sessionFeature?.logout(kicked);
}

export async function requestNotificationPermission() {
    await notificationsFeature?.requestPermission();
}

function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = i18nService.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = i18nService.t(key);
    });

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const appName = i18nService.t('app_name');
    if (pageTitle) pageTitle.innerText = appName;
    if (pageSubtitle) pageSubtitle.innerText = i18nService.t('page_subtitle');

    const tabName = i18nService.t(currentTab);
    document.title = `${appName} | ${tabName}`;
}

function updateLangSwitcherUI() {
    const lang = i18nService.getLanguage();
    document.querySelectorAll('.lang-link').forEach(link => {
        const isActive = link.getAttribute('data-lang') === lang;
        link.classList.toggle('active', isActive);
    });
}

export function changeLanguage(lang) {
    i18nService.setLanguage(lang);
}
