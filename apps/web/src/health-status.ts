import { useEffect, useState } from "react";
import { checkHealth } from "./health";

export type ServerState = "checking" | "reachable" | "unreachable";

/** Asks the API once whether it is reachable. */
export function useServerStatus(): ServerState {
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
  return server;
}
