export function bindActionRouter(actionMap) {
    document.addEventListener('click', async (event) => {
        const stopContainer = event.target.closest('[data-stop-propagation="true"]');
        const target = event.target.closest('[data-action]');
        if (!target) return;

        if (stopContainer && !stopContainer.contains(target)) {
            event.stopPropagation();
            return;
        }

        const action = target.dataset.action;
        const handler = actionMap[action];
        if (!handler) return;

        event.preventDefault();
        if (target.dataset.stopPropagation === 'true') {
            event.stopPropagation();
        }

        await handler({ event, target, dataset: target.dataset });
    });
}
