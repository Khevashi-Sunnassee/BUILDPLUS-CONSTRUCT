import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/offline/register-sw";
import { syncEngine } from "./lib/offline/sync-engine";

registerServiceWorker();
syncEngine.initialize();

createRoot(document.getElementById("root")!).render(<App />);
