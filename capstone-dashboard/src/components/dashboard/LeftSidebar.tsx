/*
 * Left navigation sidebar. Displays the Oleson Lab logo and title, and lets
 * the user switch between the Fisheries layer and the Ecosystem Extents layer.
 * Calls onLayerChange to reset selected map regions when the layer is toggled.
 */
"use client";

import styles from "@/css/leftSideBar.module.css"
import { useState } from 'react'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faX, faSliders } from '@fortawesome/free-solid-svg-icons'
import Image from "next/image";

interface LeftSidebarProps {
  layer: string;
  setLayer: (layer: string) => void;
  datatype: string;
  setDatatype: (datatype: string) => void;
  onLayerChange?: () => void;
  onFilterShownChange: (status: boolean, x: number, y: number) => void;
}

export default function LeftSidebar({ layer, setLayer, datatype, setDatatype, onLayerChange, onFilterShownChange }: LeftSidebarProps) {
  const [filterShown, setFilterShown] = useState(false)

  const handleLayer = (val: string) => {
    setFilterShown(false)
    setLayer(val);
    onLayerChange?.();
  };

  const handleDataType = (val: string) => {
    onFilterShownChange(false, -1, -1)
    setFilterShown(false)
    setDatatype(val);
  };

  const handleFilterDisplayChange = (evt: React.MouseEvent<HTMLDivElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect()
    const xPos = rect.left
    const yPos = (rect.top + rect.bottom) / 2
    onFilterShownChange(!filterShown, xPos, yPos)
    setFilterShown(!filterShown)
  }

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
            <div className={styles["left-nav-item-flex"]}>
              <p className={`${styles["left-nav-subitem"]} ${datatype === "noncomm" ? styles.active : ""}`} onClick={() => handleDataType("noncomm")} >Non-Commercial EVs</p>
              {datatype === "noncomm" && (
                <div className={styles["left-nav-filter-btn"]} onClick={(e) => handleFilterDisplayChange(e)}>
                  {!filterShown ? 
                  <FontAwesomeIcon icon={faSliders} className={styles["left-nav-filter-icon"]}/> : 
                  <FontAwesomeIcon icon={faX} className={styles["left-nav-filter-icon"]}/>}
                </div>)}
            </div>

            <div className={styles["left-nav-item-flex"]}>
              <p className={`${styles["left-nav-subitem"]} ${datatype === "comm" ? styles.active : ""}`} onClick={() => handleDataType("comm")} >Commercial EVs</p>
              {datatype === "comm" && (
                <div className={styles["left-nav-filter-btn"]} onClick={(e) => handleFilterDisplayChange(e)}>
                  {!filterShown ? 
                  <FontAwesomeIcon icon={faSliders} className={styles["left-nav-filter-icon"]}/> : 
                  <FontAwesomeIcon icon={faX} className={styles["left-nav-filter-icon"]}/>}
                </div>)}
            </div>
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
            <div className={styles["left-nav-item-flex"]}>
              <p className={`${styles["left-nav-subitem"]} ${datatype === "terrestrial" ? styles.active : ""}`} onClick={() => handleDataType("terrestrial")} >Terrestrial Extents</p>
              {datatype === "terrestrial" && (
                <div className={styles["left-nav-filter-btn"]} onClick={(e) => handleFilterDisplayChange(e)}>
                  {!filterShown ? 
                  <FontAwesomeIcon icon={faSliders} className={styles["left-nav-filter-icon"]}/> : 
                  <FontAwesomeIcon icon={faX} className={styles["left-nav-filter-icon"]}/>}
                </div>)}
            </div>

            <div className={styles["left-nav-item-flex"]}>
              <p className={`${styles["left-nav-subitem"]} ${datatype === "marine" ? styles.active : ""}`} onClick={() => handleDataType("marine")} >Marine Extents</p>
              {datatype === "marine" && (
                <div className={styles["left-nav-filter-btn"]} onClick={(e) => handleFilterDisplayChange(e)}>
                  {!filterShown ? 
                  <FontAwesomeIcon icon={faSliders} className={styles["left-nav-filter-icon"]}/> : 
                  <FontAwesomeIcon icon={faX} className={styles["left-nav-filter-icon"]}/>}
                </div>)}
            </div>
          </div>
        )}
      </div>

      <div className={`${styles["left-nav-item"]} ${layer === "recreation" ? styles.active : ""}`}>
        <p onClick={() => {
          handleLayer("recreation")
          handleDataType("terrestrial")
        }} className={styles["left-nav-item-title"]}>Recreation</p>
      </div>
    </div>
  );
}
