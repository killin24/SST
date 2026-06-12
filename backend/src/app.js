import express from "express";
import cors from "cors";

import issRoutes from "./routes/issRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/iss", issRoutes);

app.use(errorHandler);

export default app;