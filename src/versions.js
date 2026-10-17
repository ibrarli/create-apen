// Dependency versions written into generated projects.
// Majors are pinned to releases whose APIs the templates are written against.
export const NPM = {
  // frontend
  react: "^19.3.1",
  "react-dom": "^19.3.1",
  "@types/react": "^19.3.0",
  "@types/react-dom": "^19.3.0",
  "react-router": "^7.18.4",
  vite: "^8.3.5",
  "@vitejs/plugin-react": "^6.1.2",
  "@vitejs/plugin-vue": "^6.0.10",
  vue: "^3.5.44",
  "vue-router": "^4.6.4",
  "vue-tsc": "^3.3.13",
  "@vue/tsconfig": "^0.9.1",
  pinia: "^3.0.4",
  next: "^16.4.2",
  tailwindcss: "^4.3.3",
  "@tailwindcss/vite": "^4.3.3",
  "@tailwindcss/postcss": "^4.3.3",
  zustand: "^5.0.16",
  "@reduxjs/toolkit": "^2.13.0",
  "react-redux": "^9.3.0",
  "@tanstack/react-query": "^5.104.5",
  // backend
  express: "^5.3.0",
  cors: "^2.8.6",
  helmet: "^8.3.0",
  morgan: "^1.12.1",
  dotenv: "^17.4.2",
  zod: "^4.6.7",
  mongoose: "^9.11.3",
  pg: "^8.23.1",
  mysql2: "^3.24.6",
  tsx: "^4.23.15",
  nodemon: "^3.1.14",
  "@types/express": "^5.0.6",
  "@types/cors": "^2.8.19",
  "@types/morgan": "^1.9.10",
  "@types/pg": "^8.23.1",
  // shared
  typescript: "^5.9.3",
  "@types/node": "^22.20.5",
  prettier: "^3.9.10",
  concurrently: "^10.0.6",
};

export const PYTHON = {
  fastapi: "fastapi[standard]>=0.115",
  sqlalchemy: "SQLAlchemy>=2.0",
  psycopg: "psycopg[binary]>=3.2",
  pymysql: "PyMySQL>=1.1",
  pydanticSettings: "pydantic-settings>=2.4",
};

export const DOTNET_DEFAULT_MAJOR = 10;
