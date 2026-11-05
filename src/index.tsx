/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";

// Import ConfigService first - it will set window.nostrdbConfig in its module initialization
import { detectLocalBlossomProxy } from "./services/ConfigService";

const root = document.getElementById("root");

// Load the window.nostr and window.nostrdb polyfills as separate chunks (now
// that ConfigService has set window.nostrdbConfig) and resolve the optional
// local media proxy, all before results can render.
await Promise.all([
  import("window.nostr.js"),
  import("window.nostrdb.js"),
  detectLocalBlossomProxy(),
]);

render(() => <App />, root!);
