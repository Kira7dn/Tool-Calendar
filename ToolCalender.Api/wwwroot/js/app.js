import { createApi } from './core/api.js?v=20260421-v2';
import { createUiFeature } from './features/ui.js?v=20260421-v2';
import { createSessionFeature } from './features/session.js?v=20260421-v2';
import { createNotificationsFeature } from './features/notifications.js?v=20260421-v2';
import { createPdfFeature } from './features/pdf.js?v=20260421-v2';
import { createDashboardFeature } from './features/dashboard.js?v=20260421-v2';
import { createDocumentsFeature } from './features/documents.js?v=20260421-v2';
import { createDocDetailFeature } from './features/docDetail.js?v=20260421-v2';
import { createUploadFeature } from './features/upload.js?v=20260421-v2';
import { createReviewFeature } from './features/review.js?v=20260421-v2';
import { createUsersFeature } from './features/users.js?v=20260421-v2';
import { createMyTasksFeature } from './features/myTasks.js?v=20260421-v2';
import { createSettingsFeature } from './features/settings.js?v=20260421-v2';
import { createAdminMetaFeature } from './features/adminMeta.js?v=20260421-v2';

let currentTab = 'dashboard';
let initialized = false;
let sessionFeature;
let notificationsFeature;
let features = {};

function applyRoleRestrictions(role) {
    if (role === 'Admin') {
        document.getElementById('nav-users').style.display = 'flex';
    }

    if (role === 'CanBo' || role === 'VanThu') {
        const navMyTasks = document.getElementById('nav-my-tasks');
        if (navMyTasks) navMyTasks.style.display = 'flex';
    }

    if (role !== 'Admin' && role !== 'VanThu') {
        document.querySelector('.header-actions .btn-primary').style.display = 'none';
        document.querySelector('[data-tab="upload"]').style.display = 'none';
        if (role !== 'Admin') {
            document.querySelector('[data-tab="settings"]').style.display = 'none';
        }
    }
}

function restoreSidebarState() {
    if (localStorage.getItem('sidebar_collapsed') === '1') {
        const sidebar = document.getElementById('main-sidebar');
        const button = document.getElementById('sidebar-toggle');
        if (sidebar) sidebar.classList.add('collapsed');
        if (button) button.textContent = '\u25ba';
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

    const ui = createUiFeature();
    sessionFeature = createSessionFeature();
    const api = createApi({ onUnauthorized: () => sessionFeature.logout() });

    const context = {
        api,
        ui,
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
    document.querySelector('.user-pill p:last-child').innerText = `${username} (${role})`;

    applyRoleRestrictions(role);
    restoreSidebarState();

    context.services.refreshCoreData();
    settings.prefetch();
    showTab('dashboard');

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

    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    currentTab = tabId;
    await activateTab(tabId);
    closeSidebar();
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
    const button = document.getElementById('sidebar-toggle');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (button) {
        button.textContent = isCollapsed ? '\u25ba' : '\u25c4';
    }
    localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
}

export function logout(kicked = false) {
    sessionFeature?.logout(kicked);
}

export async function requestNotificationPermission() {
    await notificationsFeature?.requestPermission();
}
