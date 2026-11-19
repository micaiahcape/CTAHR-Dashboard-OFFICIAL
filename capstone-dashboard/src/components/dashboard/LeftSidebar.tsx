/*
 * Left navigation sidebar. Displays the Oleson Lab logo and title, and lets
 * the user switch between the Fisheries layer and the Ecosystem Extents layer.
 * Calls onLayerChange to reset selected map regions when the layer is toggled.
 */
"use client";

import styles from "@/css/leftSideBar.module.css"
import Image from "next/image";

interface LeftSidebarProps {
  layer: "fisheries" | "extents";
  setLayer: (layer: "fisheries" | "extents") => void;
  datatype: string;
  setDatatype: (datatype: string) => void;
  onLayerChange?: () => void;
}

export default function LeftSidebar({ layer, setLayer, datatype, setDatatype, onLayerChange }: LeftSidebarProps) {
  const handleLayer = (val: "fisheries" | "extents") => {
    setLayer(val);
    onLayerChange?.();
  };

  const handleDataType = (val: string) => {
    setDatatype(val);
  };

  return (
    <div className={styles["left-nav"]}>
      
      <Image src="/logo.png" className={styles["left-nav-logo"]} alt="Oleson Lab" width={144} height={48} unoptimized />
      <div className={styles["left-nav-title"]}>Hawaiʻi</div>
      <div className={styles["left-nav-subtitle"]}>Ecosystem Accounts</div>

      <div className={`${styles["left-nav-item"]} ${layer === "fisheries" ? styles.active : ""}`}>
        
        <p onClick={() => {
          handleLayer("fisheries")
          handleDataType("noncomm")
        }} className={styles["left-nav-item-title"]}>Fisheries</p>
        {layer === "fisheries" && (
          <div>
            <p className={`${styles["left-nav-subitem"]} ${datatype === "noncomm" ? styles.active : ""}`} onClick={() => handleDataType("noncomm")} >Non-Commercial EVs</p>
            <p className={`${styles["left-nav-subitem"]} ${datatype === "comm" ? styles.active : ""}`} onClick={() => handleDataType("comm")}>Commercial EVs</p>
          </div>
        )}
      </div>


      <div className={`${styles["left-nav-item"]} ${layer === "extents" ? styles.active : ""}`}>
        <p onClick={() => {
          handleLayer("extents")
          handleDataType("terrestrial")
        }} className={styles["left-nav-item-title"]}>Extents</p>
        {layer === "extents" && (
          <div>
            <p className={`${styles["left-nav-subitem"]} ${datatype === "terrestrial" ? styles.active : ""}`} onClick={() => handleDataType("terrestrial")} >Terrestrial extents</p>
            <p className={`${styles["left-nav-subitem"]} ${datatype === "marine" ? styles.active : ""}`} onClick={() => handleDataType("marine")}>Marine extents</p>
          </div>
        )}
      </div>

      <div className={`${styles["left-nav-subitem"]} ${datatype == "recreation" ? styles.active : ""}`}>
        <p onClick={() => handleLayer("recreation")} className="left-nav-item-title">Recreation</p>
      </div>
    </div>
  );
}
