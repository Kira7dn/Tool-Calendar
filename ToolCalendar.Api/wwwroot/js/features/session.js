export function createSessionFeature() {
    let kickCountdown = null;

    function init() {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        const eventSource = new EventSource(`/api/auth/events?access_token=${encodeURIComponent(token)}`);
        eventSource.addEventListener('connected', () => {
            console.log('[SessionWatcher] Connected');
        });

        eventSource.addEventListener('kicked', () => {
            eventSource.close();
            showKickedModal();
        });
    }

    function logout(kicked = false) {
        localStorage.clear();
        if (kicked) {
            sessionStorage.setItem('kicked_out', '1');
        }
        window.location.href = 'login.html';
    }

    function showKickedModal() {
        const overlay = document.createElement('div');
        overlay.id = 'kicked-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        let seconds = 10;
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1e293b, #0f172a);
                border: 1px solid rgba(239,68,68,0.4);
                border-radius: 20px;
                padding: 40px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.2);
            ">
                <div style="
                    width: 72px; height: 72px;
                    background: rgba(239,68,68,0.15);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 2rem;
                    border: 2px solid rgba(239,68,68,0.3);
                ">⚠️</div>
                <h2 style="color: #ef4444; font-size: 1.3rem; margin-bottom: 12px; font-weight: 700;">Phien dang nhap bi cham dut</h2>
                <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 8px;">
                    Tai khoan cua ban da dang nhap tu mot thiet bi khac.<br>
                    Phien lam viec hien tai se duoc dang xuat tu dong.
                </p>
                <div style="background: rgba(239,68,68,0.1); border-radius: 10px; padding: 12px; margin: 20px 0; border: 1px solid rgba(239,68,68,0.2);">
                    <span style="color: #94a3b8; font-size: 0.85rem;">Tu dong dang xuat sau </span>
                    <span id="kick-countdown" style="color: #ef4444; font-size: 1.4rem; font-weight: 800; font-family: monospace;">${seconds}</span>
                    <span style="color: #94a3b8; font-size: 0.85rem;"> giay</span>
                </div>
                <button id="kick-logout-now" style="
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 32px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                ">Dang xuat ngay</button>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#kick-logout-now')?.addEventListener('click', () => logout(true));

        kickCountdown = setInterval(() => {
            seconds -= 1;
            document.getElementById('kick-countdown').innerText = seconds;
            if (seconds <= 0) {
                clearInterval(kickCountdown);
                logout(true);
            }
        }, 1000);
    }

    return {
        init,
        logout
    };
}
