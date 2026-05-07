import * as signalR from "@microsoft/signalr";

class SignalRService {
  constructor() {
    this.connection = null;
    this.listeners = new Map();
  }

  async start() {
    if (this.connection) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("/notificationHub", {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on("ReceiveNotification", (notif) => {
      console.log("[SignalR] Received Notification:", notif);
      document.dispatchEvent(new CustomEvent('realtime:notifications_updated', { detail: notif }));
    });

    this.connection.on("ReceiveComment", (data) => {
      console.log("[SignalR] Received Comment:", data);
      document.dispatchEvent(new CustomEvent('realtime:new_comment', { detail: data }));
    });

    try {
      await this.connection.start();
      console.log("[SignalR] Connected successfully");
    } catch (err) {
      console.error("[SignalR] Connection failed:", err);
      setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}

export const signalRService = new SignalRService();
