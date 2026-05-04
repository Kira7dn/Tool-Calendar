export async function fetchPartial(path) {
    const version = typeof window !== 'undefined' && window.__APP_VERSION__
        ? `?v=${encodeURIComponent(window.__APP_VERSION__)}`
        : '';
    const res = await fetch(`${path}${version}`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Cannot load partial: ${path}`);
    }
    return res.text();
}

export async function appendPartials(host, paths) {
    const fragments = await Promise.all(paths.map(fetchPartial));
    host.innerHTML = fragments.join('\n');
}

export function escapeAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
