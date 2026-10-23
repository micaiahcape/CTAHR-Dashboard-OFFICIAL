"use client";

import React, { useState, useEffect } from "react";
import ReactSlider from "react-slider";
import { ExtentsFilterSettings, ExtentsFilterOptions } from "./ExtentsDashboard";
import "../dashboard/dashboard.css";

interface FilterProps {
    filterOptions: ExtentsFilterOptions,
    currentFilter: ExtentsFilterSettings,
    onChangeFilter: (obj: ExtentsFilterSettings) => void;
}

const pickDefault = (values: string[], aggregateLabel: string) =>
	values.includes(aggregateLabel) ? aggregateLabel : values[0] ?? "";

export default function ExtentsFilterMenu({
    filterOptions,
    currentFilter,
    onChangeFilter,
} : FilterProps) {
    const [selectedEcosystem, setSelectedEcosystem] = React.useState <string | undefined> (currentFilter.ecosystem)
    const [selectedCounty, setSelectedCounty] = React.useState("")
    const [currentYearRange, setCurrentYearRange] = React.useState <[number, number]> ([currentFilter.startYear, currentFilter.endYear])

    // every time the state updates, send to the parent.
    useEffect(() => {
        console.log("UPDATING");
        const arg = {startYear: currentYearRange[0], endYear: currentYearRange[1], ecosystem: selectedEcosystem}
        onChangeFilter(arg)
    }, [currentYearRange, selectedCounty, selectedEcosystem])

    const minYear = filterOptions.years[0]
    const maxYear = filterOptions.years[filterOptions.years.length - 1]

    const calculatedMarginLeft = (() => {
        const range = maxYear - minYear;
        const leftPercent = ((currentYearRange[0] - minYear) / range) * 100;
        const rightPercent = ((currentYearRange[1] - minYear) / range) * 100;
        const resultantPercent = (leftPercent + rightPercent) / 2;

        if (resultantPercent > 85) {
            return "85%";
        } else if (resultantPercent < 15) {
            return "15%";
        }

        return (resultantPercent + "%")
        
    }) ();

    if (selectedEcosystem == "") return (<p>Please wait...</p>)

    return (
        <>
            <div className="rp-section">
                <button
                className="filter-btn"
                style={{ width: "100%" }}
                onClick={() => {
                    setSelectedCounty("");
                    setCurrentYearRange([minYear, maxYear])
                    if (filterOptions.ecosystem_list) {
                        setSelectedEcosystem(filterOptions.ecosystem_list[0]);
                    }
                }}>↺ Reset Filters</button>
            </div>

            {/* County */}
            {/* <div className="rp-section">
                <div className="filter-label">County</div>
                <select
                className="filter-select"
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                >
                <option value="">All Counties</option>
                {filterOptions.map((c) => (
                    <option key={c}>{c}</option>
                ))}
                </select>
            </div> */}

            {/* Year Range */}
            <div className="rp-section">
                <div className="filter-label">Year Range</div>
                <div style={{width: "100%", position: "relative", marginBottom: "2%"}}>
                    <div className="sliderValueHolder" style={{ marginLeft: calculatedMarginLeft}}>{currentYearRange[0]} - {currentYearRange[1]}</div>
                </div>
                
                <ReactSlider 
                value={currentYearRange}
                minDistance={0}
                step={3}
                pearling={true}
                min={minYear}
                max={maxYear}
                className="horizontal-slider"
                thumbClassName="year-thumb"
                trackClassName="year-track"
                onChange={(val: [number, number], thumbIndex: number) => {
                    setCurrentYearRange([...val]);
                }} />
            </div>

            {/* Ecosystem Type */}
            <div className="rp-section">
                <div className="filter-label">Ecosystem Type</div>
                <div className="button-group">
                {filterOptions.ecosystem_list?.map((e) => (
                    <button
                    key={e}
                    className={`filter-btn ${selectedEcosystem === e ? "active" : ""}`}
                    onClick={() => setSelectedEcosystem(e)}>{e}</button>
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