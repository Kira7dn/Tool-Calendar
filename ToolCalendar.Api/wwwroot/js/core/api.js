export function getAuthToken() {
    return localStorage.getItem('auth_token');
}

export function requireAuth() {
    if (getAuthToken()) {
        return true;
    }

    window.location.href = 'login.html';
    return false;
}

function buildHeaders(headers = {}, auth = true) {
    const merged = new Headers(headers);

    if (auth && getAuthToken() && !merged.has('Authorization')) {
        merged.set('Authorization', `Bearer ${getAuthToken()}`);
    }

    return merged;
}

export function createApi({ onUnauthorized } = {}) {
    async function request(url, options = {}) {
        const {
            auth = true,
            headers,
            ...rest
        } = options;

        const response = await fetch(url, {
            ...rest,
            headers: buildHeaders(headers, auth)
        });

        if (response.status === 401) {
            onUnauthorized?.();
        }

        return response;
    }

    async function json(url, options = {}) {
        const response = await request(url, options);
        if (!response.ok) {
            const error = new Error(`Request failed: ${response.status}`);
            error.response = response;
            throw error;
        }

        return response.json();
    }

    async function text(url, options = {}) {
        const response = await request(url, options);
        if (!response.ok) {
            const error = new Error(`Request failed: ${response.status}`);
            error.response = response;
            throw error;
        }

        return response.text();
    }

    async function blob(url, options = {}) {
        const response = await request(url, options);
        if (!response.ok) {
            const error = new Error(`Request failed: ${response.status}`);
            error.response = response;
            throw error;
        }

        return response.blob();
    }

    return {
        request,
        json,
        text,
        blob,
        get(url, options = {}) {
            return request(url, { ...options, method: 'GET' });
        },
        post(url, options = {}) {
            return request(url, { ...options, method: 'POST' });
        },
        put(url, options = {}) {
            return request(url, { ...options, method: 'PUT' });
        },
        delete(url, options = {}) {
            return request(url, { ...options, method: 'DELETE' });
        }
    };
}
