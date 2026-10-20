import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Basic healthcheck
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Placeholder route mounts (to be extended by team members)
// app.use("/api/auth", authRouter);
// app.use("/api/places", placesRouter);
// app.use("/api/reviews", reviewsRouter);
// app.use("/api/trips", tripsRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
  });
}

export default app;
