import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

/**
 * @contextvm/sdk's logger only `require`s fs/path inside a Node-only branch,
 * so give it an empty module in the browser build instead of letting Vite
 * externalize (and warn about) the Node builtins.
 */
function stubContextVMNodeBuiltins(): Plugin {
  const STUB_ID = "\0contextvm-node-builtin-stub";
  return {
    name: "stub-contextvm-node-builtins",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        (source === "fs" || source === "path") &&
        importer?.includes("/@contextvm/sdk/")
      )
        return STUB_ID;
    },
    load(id) {
      if (id === STUB_ID) return "export default {};";
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE,
  plugins: [stubContextVMNodeBuiltins(), solid(), tailwindcss()],
});
