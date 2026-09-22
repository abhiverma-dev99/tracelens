const LOCAL_ORIGINS = ["http://localhost:4200", "http://127.0.0.1:4200"];
const HOSTED_FRONTEND = "https://tracelens-frontend-virid.vercel.app";

export const getFrontendOrigins = () => {
  const fromEnv = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...fromEnv, HOSTED_FRONTEND, ...LOCAL_ORIGINS])];
};
