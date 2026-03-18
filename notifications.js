// Shared notification system for all pages

function showNotification(title, message, type = 'success') {
    // Support simple call: showNotification('Item saved!') with no message
    if (message === undefined) {
        message = '';
    }

    const notification = document.createElement('div');
    notification.className = `app-notification ${type}`;
    notification.innerHTML = message
        ? `<div class="notification-title">${title}</div><div class="notification-message">${message}</div>`
        : `<div class="notification-title">${title}</div>`;

    // Add styles once
    if (!document.getElementById('app-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'app-notification-styles';
        styles.textContent = `
            .app-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                background: white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: notifSlideIn 0.3s ease-out;
                max-width: 350px;
            }
            .app-notification.success {
                border-left: 4px solid #22c55e;
            }
            .app-notification.error {
                border-left: 4px solid #ef4444;
            }
            .app-notification.warning {
                border-left: 4px solid #f97316;
            }
            .app-notification.info {
                border-left: 4px solid #3b82f6;
            }
            .notification-title {
                font-weight: bold;
                margin-bottom: 2px;
            }
            .notification-message {
                font-size: 14px;
                color: #555;
            }
            @keyframes notifSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes notifSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.animation = 'notifSlideOut 0.3s ease-in';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// Convenience wrappers (backwards compatible with old function names)
function showSuccessMessage(message) {
    showNotification(message, '', 'success');
}

function showErrorMessage(message) {
    showNotification(message, '', 'error');
}
