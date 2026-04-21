import { requireAuth } from './core/api.js?v=20260421-ui-refresh';
import { appendPartials } from './core/dom.js?v=20260421-ui-refresh';
import { shellState } from './core/state.js?v=20260421-ui-refresh';
import { bindShellNavigation } from './features/navigation.js?v=20260421-ui-refresh';
import {
    initializeApp,
    showTab,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    logout,
    requestNotificationPermission
} from './app.js?v=20260421-ui-refresh';

const TAB_PARTIALS = [
    '/partials/tabs/dashboard.html',
    '/partials/tabs/documents.html',
    '/partials/tabs/upload.html',
    '/partials/tabs/my-tasks.html',
    '/partials/tabs/users.html',
    '/partials/tabs/settings.html'
];

const MODAL_PARTIALS = [
    '/partials/modals/user.html',
    '/partials/modals/ocr-edit.html',
    '/partials/modals/alerts.html',
    '/partials/modals/doc-detail.html',
    '/partials/modals/pdf-preview.html',
    '/partials/modals/review-side-by-side.html',
    '/partials/modals/department.html',
    '/partials/modals/label.html',
    '/partials/modals/rule.html',
    '/partials/modals/evidence.html'
];

async function bootstrap() {
    if (!requireAuth()) return;

    await appendPartials(document.getElementById('tab-host'), TAB_PARTIALS);
    shellState.tabsLoaded = true;

    await appendPartials(document.getElementById('modal-host'), MODAL_PARTIALS);
    shellState.modalsLoaded = true;

    bindShellNavigation({
        showTab,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        logout,
        requestNotificationPermission
    });

    initializeApp();
    shellState.bootstrapped = true;
}

bootstrap().catch((error) => {
    console.error('Frontend bootstrap failed:', error);
});
