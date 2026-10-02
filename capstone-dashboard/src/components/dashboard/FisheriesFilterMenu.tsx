"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import ReactSlider from "react-slider";

interface FilterProps {
    speciesGroups: string[];
    ecosystemTypes: string[];
    counties: string[];
    yearRange: [number, number];
    onChangeFilter: (yearStart: number, yearEnd: number, county: string, species: string, ecosystem: string, dataset: "noncomm" | "comm") => void;
}

export default function FisheriesFilterMenu({
    speciesGroups,
    ecosystemTypes,
    counties,
    yearRange,
    onChangeFilter,
} : FilterProps) {
    const [selectedSpecies, setSelectedSpecies] = React.useState(speciesGroups.includes("All Species") ? "All Species" : speciesGroups[0] ?? "")
    const [selectedEcosystem, setSelectedEcosystem] = React.useState(ecosystemTypes.includes("All Ecosystems") ? "All Ecosystems" : ecosystemTypes[0] ?? "")
    const [selectedDataset, setSelectedDataset] = React.useState<"noncomm" | "comm">("noncomm")
    const [currentYearRange, setCurrentYearRange] = React.useState(yearRange)
    const [selectedCounty, setSelectedCounty] = React.useState("")

    useEffect(() => {
        console.log("UPDATING");
        onChangeFilter(currentYearRange[0], currentYearRange[1], selectedCounty, selectedSpecies, selectedEcosystem, selectedDataset)
    }, [currentYearRange, selectedCounty, selectedSpecies, selectedEcosystem, selectedDataset])

    const calculatedMarginLeft = (() => {
        const range = yearRange[1] - yearRange[0];
        const leftPercent = ((currentYearRange[0] - yearRange[0]) / range) * 100;
        const rightPercent = ((currentYearRange[1] - yearRange[0]) / range) * 100;
        return ((leftPercent + rightPercent) / 2) + "%";
    }) ();

    return(
        <>
            {/* Reset */}
            <div className="rp-section">
                <button
                className="filter-btn"
                style={{ width: "100%" }}
                onClick={() => {
                    setSelectedCounty("");
                    setCurrentYearRange(yearRange)
                    setSelectedSpecies(speciesGroups.includes("All Species") ? "All Species" : speciesGroups[0] ?? "");
                    setSelectedEcosystem(ecosystemTypes.includes("All Ecosystems") ? "All Ecosystems" : ecosystemTypes[0] ?? "");
                }}
                >
                ↺ Reset Filters
                </button>
            </div>

            {/* Data Source */}
            
            <div className="rp-section">
                <div className="filter-label">Data Source</div>
                <select
                className="filter-select"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value as "noncomm" | "comm")}
                >
                <option value="noncomm">Non-Commercial</option>
                <option value="comm">Commercial</option>
                </select>
            </div>

            {/* County */}
            <div className="rp-section">
                <div className="filter-label">County</div>
                <select
                className="filter-select"
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                >
                <option value="">All Counties</option>
                {counties.map((c) => (
                    <option key={c}>{c}</option>
                ))}
                </select>
            </div>

            {/* Year Range */}
            <div className="rp-section">
                <div className="filter-label">Year Range</div>
                <div style={{width: "100%", position: "relative"}}>
                    <div className="sliderValueHolder" style={{ marginLeft: calculatedMarginLeft}}>{currentYearRange[0]} - {currentYearRange[1]} </div>
                </div>
                
                <ReactSlider 
                defaultValue={yearRange}
                value={currentYearRange}
                minDistance={0}
                pearling={true}
                min={yearRange[0]}
                max={yearRange[1]}
                className="horizontal-slider"
                thumbClassName="year-thumb"
                trackClassName="year-track"
                onChange={(val: [number, number], thumbIndex: number) => {
                    setCurrentYearRange([...val]);
                }} />
            </div>

            {/* Species Group */}
            <div className="rp-section">
                <div className="filter-label">Species Group</div>
                <div className="button-group">
                {speciesGroups.map((s) => (
                    <button
                    key={s}
                    className={`filter-btn ${selectedSpecies === s ? "active" : ""}`}
                    onClick={() => setSelectedSpecies(s)}>{s}</button>
                ))}
                </div>
            </div>

            {/* Ecosystem Type */}
            <div className="rp-section">
                <div className="filter-label">Ecosystem Type</div>
                <div className="button-group">
                {ecosystemTypes.map((e) => (
                    <button
                    key={e}
                    className={`filter-btn ${selectedEcosystem === e ? "active" : ""}`}
                    onClick={() => setSelectedEcosystem(e)}
                    >
                    {e}
                    </button>
                ))}
                </div>
            </div>
            
            
            {/* Download */}
            {/*
            <div className="rp-section">
                <div className="filter-label">Download CSV</div>
                <select
                className="filter-select"
                value={downloadMode}
                onChange={(e) => setDownloadMode(e.target.value as "ALL_SEPARATE" | "ONE_COUNTY")}
                >
                <option value="ONE_COUNTY">One county</option>
                <option value="ALL_SEPARATE">All counties (separate files)</option>
                </select>

                {downloadMode === "ONE_COUNTY" && (
                <select
                    className="filter-select"
                    value={downloadCounty}
                    onChange={(e) => setDownloadCounty(e.target.value)}
                    style={{ marginTop: 8 }}
                >
                    <option value="">Choose a county…</option>
                    {counties.map((c) => <option key={c}>{c}</option>)}
                </select>
                )}

                <button
                className="filter-btn"
                style={{ marginTop: 10 }}
                onClick={() => handleDownload(downloadMode, downloadMode === "ONE_COUNTY" ? downloadCounty : undefined)}
                disabled={downloadMode === "ONE_COUNTY" && !downloadCounty}
                >
                Download CSV
                </button>
            </div>*/}
            </>
    )
}