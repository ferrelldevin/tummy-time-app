import { useEffect, useState } from "react";
import { checkHealth } from "./health";
import { en } from "./strings/en";

type ServerState = "checking" | "reachable" | "unreachable";

export function App() {
  const [server, setServer] = useState<ServerState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    void checkHealth(controller.signal).then((ok) => {
      if (!controller.signal.aborted) {
        setServer(ok ? "reachable" : "unreachable");
      }
    });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main>
      <h1>{en.appName}</h1>
      <p role="status">{en.server[server]}</p>
    </main>
  );
}
