export function createSessionFeature() {
    let kickCountdown = null;

    function init() {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        // Khởi tạo SignalR thay vì SSE
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/notificationHub", {
                accessTokenFactory: () => token
            })
            .withAutomaticReconnect()
            .build();

        connection.on("ReceiveNotification", (data) => {
            document.dispatchEvent(new CustomEvent('realtime:notification', { detail: data }));
        });

        connection.on("ReceiveComment", (data) => {
            document.dispatchEvent(new CustomEvent('realtime:new_comment', { detail: data }));
        });

        connection.on("DeleteComment", (data) => {
            document.dispatchEvent(new CustomEvent('realtime:delete_comment', { detail: data }));
        });

        connection.on("ReceiveReaction", (data) => {
            document.dispatchEvent(new CustomEvent('realtime:comment_reaction', { detail: data }));
        });

        connection.on("Kicked", (message) => {
            connection.stop();
            showKickedModal();
        });

        connection.start().catch(err => console.error('[SignalR] Connection Error: ', err));
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
                <h2 style="color: #ef4444; font-size: 1.3rem; margin-bottom: 12px; font-weight: 700;">Phiên đăng nhập bị chấm dứt</h2>
                <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 8px;">
                    Tài khoản của bạn đã đăng nhập từ một thiết bị khác.<br>
                    Phiên làm việc hiện tại sẽ được đăng xuất tự động.
                </p>
                <div style="background: rgba(239,68,68,0.1); border-radius: 10px; padding: 12px; margin: 20px 0; border: 1px solid rgba(239,68,68,0.2);">
                    <span style="color: #94a3b8; font-size: 0.85rem;">Tự động đăng xuất sau </span>
                    <span id="kick-countdown" style="color: #ef4444; font-size: 1.4rem; font-weight: 800; font-family: monospace;">${seconds}</span>
                    <span style="color: #94a3b8; font-size: 0.85rem;"> giây</span>
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
                ">Đăng xuất ngay</button>
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
