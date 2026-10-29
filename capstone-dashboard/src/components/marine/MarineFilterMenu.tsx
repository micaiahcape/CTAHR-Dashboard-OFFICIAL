"use client";

import React, { useState, useEffect } from "react";
import ReactSlider from "react-slider";
import { MarineFilterOptions, MarineFilterSettings } from "./MarineDashboard";
import "../dashboard/dashboard.css";

interface FilterProps {
    filterOptions: MarineFilterOptions,
    currentFilter: MarineFilterSettings,
    onChangeFilter: (obj: MarineFilterSettings) => void;
}

const pickDefault = (values: string[], aggregateLabel: string) =>
	values.includes(aggregateLabel) ? aggregateLabel : values[0] ?? "";

export default function MarineFilterMenu({
    filterOptions,
    currentFilter,
    onChangeFilter,
} : FilterProps) {
    const [selectedVariable, setSelectedVariable] = React.useState <string | undefined> (currentFilter.variable)
    const [selectedCounty, setSelectedCounty] = React.useState("")
    const [currentYear, setCurrentYear] = React.useState <number> (currentFilter.year)

    // every time the state updates, send to the parent.
    useEffect(() => {
        console.log("UPDATING");
        const arg = {year: currentYear, variable: selectedVariable}
        onChangeFilter(arg)
    }, [selectedVariable, selectedCounty, currentYear])

    const minYear = filterOptions.years[0]
    const maxYear = filterOptions.years[filterOptions.years.length - 1]

    const calculatedMarginLeft = (() => {
        const range = maxYear - minYear;
        const resultantPercent = ((currentYear - minYear) / range) * 100;

        if (resultantPercent > 85) {
            return "85%";
        } else if (resultantPercent < 15) {
            return "15%";
        }

        return (resultantPercent + "%")
        
    }) ();

    if (selectedVariable == "") return (<p>Please wait...</p>)

    return (
        <>
            <div className="rp-section">
                <button
                className="filter-btn"
                style={{ width: "100%" }}
                onClick={() => {
                    setSelectedCounty("");
                    setCurrentYear(maxYear)
                    if (filterOptions.variable_list) {
                        setSelectedVariable(filterOptions.variable_list[0]);
                    }
                }}>↺ Reset Filters</button>
            </div>

            <div className="rp-section">
                <div className="filter-label">Year Range</div>
                <div style={{width: "100%", position: "relative", marginBottom: "2%"}}>
                    <div className="sliderValueHolder" style={{ marginLeft: calculatedMarginLeft}}>{currentYear}</div>
                </div>
                
                <ReactSlider 
                value={currentYear}
                minDistance={0}
                step={3}
                pearling={true}
                min={minYear}
                max={maxYear}
                className="horizontal-slider"
                thumbClassName="year-thumb"
                trackClassName="year-track"
                onChange={(val: number, thumbIndex: number) => {
                    setCurrentYear(val);
                }} />
            </div>

            {/* Ecosystem Type */}
            <div className="rp-section">
                <div className="filter-label">Variable</div>
                <div className="button-group">
                {filterOptions.variable_list?.map((e) => (
                    <button
                    key={e}
                    className={`filter-btn ${selectedVariable === e ? "active" : ""}`}
                    onClick={() => setSelectedVariable(e)}>{e}</button>
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