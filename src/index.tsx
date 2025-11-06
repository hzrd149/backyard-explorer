import "window.nostr.js";
/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";

// Import ConfigService first - it will set window.nostrdbConfig in its module initialization
import "./services/ConfigService";

// Now import window.nostr.js and window.nostrdb.js with config already set
import "window.nostrdb.js";

const root = document.getElementById("root");

// Mount app
render(() => <App />, root!);
