import { ConnectionStatus, WebSocketEvent } from "../types";

export type EventCallback = (event: WebSocketEvent) => void;
export type StatusCallback = (status: ConnectionStatus) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private eventListeners: Set<EventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private currentStatus: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private shouldReconnect = true;

  constructor() {
    const explicitWs = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    if (explicitWs) {
      this.url = explicitWs;
      return;
    }

    const explicitApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
    if (explicitApi) {
      const cleanApi = explicitApi.replace(/\/+$/, "").replace(/\/api$/, "");
      if (cleanApi.startsWith("https://")) {
        this.url = `${cleanApi.replace("https://", "wss://")}/ws`;
        return;
      }
      if (cleanApi.startsWith("http://")) {
        this.url = `${cleanApi.replace("http://", "ws://")}/ws`;
        return;
      }
    }

    const wsProto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${wsProto}//127.0.0.1:8000/ws`;
  }

  public connect() {
    this.shouldReconnect = true;
    this.setStatus("connecting");

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.notifyEvent(parsed);
        } catch (err) {
          console.warn("Failed to parse WebSocket event:", err);
        }
      };

      this.socket.onclose = () => {
        if (this.currentStatus !== "disconnected") {
          this.setStatus("disconnected");
        }
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        // Handled via onclose
      };
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    this.setStatus("reconnecting");
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  private notifyEvent(event: WebSocketEvent) {
    this.eventListeners.forEach((cb) => cb(event));
  }

  public onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  public onStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }
}

export const wsClient = new WebSocketClient();
