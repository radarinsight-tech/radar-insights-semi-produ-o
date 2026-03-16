export type AppMode = "demo" | "test" | "production";

const RAW = import.meta.env.VITE_APP_MODE as string | undefined;

export const APP_MODE: AppMode =
  RAW === "demo" || RAW === "test" || RAW === "production" ? RAW : "production";

export const isDemo = APP_MODE === "demo";
export const isTest = APP_MODE === "test";
export const isProduction = APP_MODE === "production";
