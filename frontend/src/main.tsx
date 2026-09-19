import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import App from "./App";
import { LiveProvider } from "./services/live";
import "./styles.css";
import "./live.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LiveProvider><App /></LiveProvider>
    </BrowserRouter>
  </StrictMode>
);
