// ZEN host adapter. Upstream Tauri/network commands are deliberately not loaded.
// Sound customization is local-only; built-ins are loaded from the packaged assets.
export const Bridge={customSounds:async(_names:readonly string[])=>[] as string[],customSound:async(_name:string)=>null as ArrayBuffer|null};
