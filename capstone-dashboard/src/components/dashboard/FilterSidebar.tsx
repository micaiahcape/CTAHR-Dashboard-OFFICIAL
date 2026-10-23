/*
 * Left navigation sidebar. Displays the Oleson Lab logo and title, and lets
 * the user switch between the Fisheries layer and the Ecosystem Extents layer.
 * Calls onLayerChange to reset selected map regions when the layer is toggled.
 */
"use client";

import "./dashboard.css";
import Image from "next/image";

interface FilterSidebarProps {
  layer: "fisheries" | "extents";
  setLayer: (layer: "fisheries" | "extents") => void;
  datatype: string;
  setDatatype: (datatype: string) => void;
  onLayerChange?: () => void;
}

export default function FilterSidebar({ layer, setLayer, datatype, setDatatype, onLayerChange }: FilterSidebarProps) {
  const handleLayer = (val: "fisheries" | "extents") => {
    setLayer(val);
    onLayerChange?.();
  };

  const handleDataType = (val: string) => {
    setDatatype(val);
  };

  return (
    <div className="left-nav">
      
      <Image src="/logo.png" className="left-nav-logo" alt="Oleson Lab" width={144} height={48} unoptimized />
      <div className="left-nav-title">Hawaiʻi</div>
      <div className="left-nav-subtitle">Ecosystem Accounts</div>

      <div className={`left-nav-item ${layer === "fisheries" ? "active" : ""}`}>
        <p onClick={() => {
          handleLayer("fisheries")
          handleDataType("noncomm")
        }} className="left-nav-item-title">Fisheries</p>
        {layer === "fisheries" && (
          <div>
            <p className={`left-nav-subitem ${datatype === "noncomm" ? "active" : ""}`} onClick={() => handleDataType("noncomm")} >Non-Commercial EVs</p>
            <p className={`left-nav-subitem ${datatype === "comm" ? "active" : ""}`} onClick={() => handleDataType("comm")}>Commercial EVs</p>
          </div>
        )}
      </div>


      <div className={`left-nav-item ${layer === "extents" ? "active" : ""}`}>
        <p onClick={() => {
          handleLayer("extents")
          handleDataType("terrestrial")
        }} className="left-nav-item-title">Extents</p>
        {layer === "extents" && (
          <div>
            <p className={`left-nav-subitem ${datatype === "terrestrial" ? "active" : ""}`} onClick={() => handleDataType("terrestrial")} >Terrestrial extents</p>
            <p className={`left-nav-subitem ${datatype === "marine" ? "active" : ""}`} onClick={() => handleDataType("marine")}>Marine extents</p>
          </div>
        )}
      </div>

      <div className={`left-nav-item ${layer === "recreation" ? "active" : ""}`}>
        <p onClick={() => handleLayer("recreation")} className="left-nav-item-title">Recreation</p>
      </div>
    </div>
  );
}
