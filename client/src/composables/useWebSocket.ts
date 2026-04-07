import { ref, watch } from 'vue';
import type { StoryEvent } from '../types';

const connected = ref(false);
let ws: WebSocket | null = null;
let onEvent: ((msg: any) => void) | null = null;

export function useWebSocket() {
  function connect(eventHandler: (msg: any) => void) {
    onEvent = eventHandler;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected.value = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (onEvent) onEvent(msg);
      } catch {}
    };

    ws.onclose = () => {
      connected.value = false;
      // 자동 재연결
      setTimeout(() => connect(eventHandler), 3000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function subscribe(sessionId: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    }
  }

  function disconnect() {
    ws?.close();
    ws = null;
    connected.value = false;
  }

  return {
    connected,
    connect,
    subscribe,
    disconnect,
  };
}
