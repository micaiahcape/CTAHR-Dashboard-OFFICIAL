/*
 * Left navigation sidebar. Displays the Oleson Lab logo and title, and lets
 * the user switch between the Fisheries layer and the Ecosystem Extents layer.
 * Calls onLayerChange to reset selected map regions when the layer is toggled.
 */
"use client";

import Image from "next/image";

interface FilterSidebarProps {
  layer: "fisheries" | "extents";
  setLayer: (layer: "fisheries" | "extents") => void;
  onLayerChange?: () => void;
}

export default function FilterSidebar({ layer, setLayer, onLayerChange }: FilterSidebarProps) {
  const handleLayer = (val: "fisheries" | "extents") => {
    setLayer(val);
    onLayerChange?.();
  };

  return (
    <div className="left-nav">
      
      <Image src="/logo.png" className="left-nav-logo" alt="Oleson Lab" width={144} height={48} unoptimized />
      <div className="left-nav-title">Hawaiʻi</div>
      <div className="left-nav-subtitle">Ecosystem Accounts</div>

      <div
        className={`left-nav-item ${layer === "fisheries" ? "active" : ""}`}
        onClick={() => handleLayer("fisheries")}
      >
        Fisheries
      </div>
      <div
        className={`left-nav-item ${layer === "extents" ? "active" : ""}`}
        onClick={() => handleLayer("extents")}
      >
        Ecosystem Extents
      </div>
    </div>
  );
}
