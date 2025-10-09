/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";

const root = document.getElementById("root");

setTimeout(async () => {
  // @ts-ignore missing types
  await import("window.nostr.js");

  window.nostrdbConfig = {
    primalUserLookup: true,
    // @ts-ignore missing types
    vertexUserLookup: !!window.nostr,
    // @ts-ignore missing types
    vertexSigner: () => window.nostr,
  };

  // Lazily polyfill window.nostrdb
  await import("window.nostrdb.js");

  // Mount app
  render(() => <App />, root!);
}, 100);
