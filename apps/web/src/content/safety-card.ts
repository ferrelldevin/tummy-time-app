import { parseSafetyCardFile } from "@tummy/shared";
import cardSource from "../../../../content/safety-card.json?raw";

// Bundled at build time and part of first load: the "When to call" card must open without a
// second download. The file is checked by `pnpm test`; if it ever fails here the screen still
// shows the fixed emergency line (see pages/WhenToCall.tsx).
export const safetyCard = parseSafetyCardFile(cardSource);
