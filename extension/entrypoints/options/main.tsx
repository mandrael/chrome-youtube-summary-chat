import ReactDOM from "react-dom/client";
import { Options } from "./Options";
import "@/assets/tailwind.css";

// Die Options-Page folgt dem System-Theme; im Content-Script übernimmt YouTubes
// dark-Attribut diese Rolle.
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Options />);
