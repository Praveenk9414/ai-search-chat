type Handlers = {
  onTool: (tool: { name: string; message: string }) => void;
  onText: (token: string) => void;
  onCitation: (c: any) => void;
  onDone: () => void;
};

export function startChatStream(query: string, handlers: Handlers) {
  const url = `http://localhost:8000/chat/stream?query=${encodeURIComponent(
    query
  )}`;

  const eventSource = new EventSource(url);

  eventSource.addEventListener("tool", (e) => {
    handlers.onTool(JSON.parse(e.data));
  });

  eventSource.addEventListener("text", (e) => {
    handlers.onText(e.data);
  });

  eventSource.addEventListener("citation", (e) => {
    handlers.onCitation(JSON.parse(e.data));
  });

  eventSource.addEventListener("done", () => {
    eventSource.close();
    handlers.onDone();
  });

  eventSource.onerror = () => {
    eventSource.close();
  };

  return eventSource;
}
