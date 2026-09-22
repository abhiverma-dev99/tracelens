/** Vercel production hosts plus FRONTEND_ORIGIN and local Angular serve. */
const LOCAL_ORIGINS = ["http://localhost:4200", "http://127.0.0.1:4200"];
const HOSTED_FRONTENDS = [
  "https://tracelens-frontend-virid.vercel.app",
  "https://tracelens-frontend-tracelens.vercel.app",
];

export const getFrontendOrigins = () => {
  const fromEnv = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...fromEnv, ...HOSTED_FRONTENDS, ...LOCAL_ORIGINS])];
};
