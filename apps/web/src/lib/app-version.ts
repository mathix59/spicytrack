declare const __APP_VERSION__: string | undefined;

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "development";

export { APP_VERSION };
