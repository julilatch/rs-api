import { configDotenv } from "dotenv";

configDotenv();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import AiRoutes from "./routes/ai.route";

const origins = [
  "http://localhost:3000",
  "http://localhost:8000",
  "https://rock-statements.vercel.app",
];

const app = express();

app.use(cors({ origin: origins }));
app.use(morgan("dev"));
app.use(express.json());


const port = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.json({ message: "RS API" });
});

app.use("/api/v1/ai", AiRoutes);

app.listen(port, () => {
  console.log(`Server running on port http://127.0.0.1:${port}`);
});
