import { safetyCard } from "../content/safety-card";
import { WhenToCall } from "./WhenToCall";

export function WhenToCallRoute() {
  return <WhenToCall card={safetyCard.ok ? safetyCard.value : null} />;
}
