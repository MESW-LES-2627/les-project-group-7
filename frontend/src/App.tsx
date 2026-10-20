import { useState, useEffect } from "react";

export default function App() {
  const [healthStatus, setHealthStatus] = useState<string>("connecting...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealthStatus(`Backend online (${data.status})`))
      .catch(() => setHealthStatus("Backend not reachable"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header>
        <h1>Place Reviews & Trip Planning</h1>
        <p>Group 7 · MESW LES 2026-27</p>
        <p style={{ color: "#666" }}>API Status: <strong>{healthStatus}</strong></p>
      </header>

      <main style={{ marginTop: "2rem" }}>
        <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1.5rem" }}>
          <h2>Iteration 0 — Scaffolding Complete</h2>
          <p>The workspace is ready for development across modules:</p>
          <ul>
            <li><strong>Place Catalog & Discovery:</strong> OSM import, city search, map view.</li>
            <li><strong>Reviews & Ratings:</strong> Rating and price level calculation.</li>
            <li><strong>Saved Places & Lists:</strong> Wishlist and custom collections.</li>
            <li><strong>Trip Planner:</strong> Day-by-day itineraries and travel time estimates.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
