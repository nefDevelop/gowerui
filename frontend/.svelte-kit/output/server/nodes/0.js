

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.js";
export const imports = ["_app/immutable/nodes/0.D6q0i2JG.js","_app/immutable/chunks/Db1JfvrS.js","_app/immutable/chunks/0Y05Iz8o.js","_app/immutable/chunks/CuTfMQt5.js","_app/immutable/chunks/wnWoRlNl.js","_app/immutable/chunks/DkFVIDlP.js"];
export const stylesheets = ["_app/immutable/assets/0.C7n35rgx.css"];
export const fonts = [];
