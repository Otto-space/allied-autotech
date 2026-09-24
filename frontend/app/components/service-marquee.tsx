"use client";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
const services = [
  "Diagnostics",
  "Maintenance",
  "Tyres",
  "Wheel Alignment",
  "Genuine Parts",
  "Car Sales",
];
export function ServiceMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={`service-marquee ${paused ? "is-paused" : ""}`}>
      <p className="sr-only">Our services: {services.join(", ")}.</p>
      <div className="marquee-window" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div className="marquee-group" key={copy}>
              {services.map((service) => (
                <span key={service}>
                  {service}
                  <span className="marquee-separator">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-label={paused ? "Resume service marquee" : "Pause service marquee"}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
  );
}
