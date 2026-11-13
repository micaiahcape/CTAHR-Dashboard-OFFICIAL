"use client";

import React, { useState, useEffect, useMemo } from "react";
import ReactSlider from "react-slider";
import "../dashboard/dashboard.css";

interface FilterProps {
    filterOptions: Record<string, any[]>,
    currentFilter: Record<string, any>,
    filterDescriptions: {
        btnVars: string[],
        dropdownVars: string[],
        singleRangeVars: string[],
        doubleRangeVars: string[],
        displayText: Record<string, string>, // must be "variable name": "display"
        correspondingVariable: Record<string, string>
    }
    onChangeFilter: (obj: Record<string, any>) => void;
}

interface IndividualFilterDescription {
    options: string[],
    displayText: string,
    variableType: string,
    correspondingVariable: string,
}

export default function DashboardFilterMenu({
    filterOptions,
    currentFilter,
    filterDescriptions,
    onChangeFilter,
} : FilterProps) {

    const variableSummary = useMemo(() => {
        // consolidate everything.
        const {displayText, correspondingVariable, ...r} = filterDescriptions
        const invertedDesignations = Object.fromEntries(
            Object.entries(r).flatMap(([key, values]) => values.map((v) => [v, key]))
        )

        const condensedFilterInfo: Record<string, IndividualFilterDescription> = {}
        Object.keys(filterDescriptions.displayText).forEach((variable: string) => {
            condensedFilterInfo[variable] = {
                options: filterOptions[variable],
                displayText: filterDescriptions.displayText[variable],
                variableType: invertedDesignations[variable],
                correspondingVariable: filterDescriptions.correspondingVariable[variable]
            }
        })

        return condensedFilterInfo
    }, [])

    function changeFilter(key: string, value: any) {
        const currentFilterCopy = {...currentFilter}
        currentFilterCopy[key] = value
        onChangeFilter(currentFilterCopy)
    }

    function Btns (filterInfo: IndividualFilterDescription) {
        const variableToChange = filterInfo.correspondingVariable
        return(
            <div className="rp-section">
                <div className="filter-label">{filterInfo.displayText}</div>
                <div className="button-group">
                {filterInfo.options.map((e) => (
                    <button 
                    key={e} 
                    className={`filter-btn ${currentFilter[variableToChange] === e ? "active" : ""}`} 
                    onClick={() => {changeFilter(variableToChange, e)}}>{e}</button>
                ))}
                </div>
            </div>
        )
    }

    function DropDowns (filterInfo: IndividualFilterDescription) {
        const variableToChange = filterInfo.correspondingVariable
        return(
            <div className="rp-section">
                <div className="filter-label">County</div>
                <select
                className="filter-select"
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                >
                <option value="">All Counties</option>
                {filterOptions.counties_list.map((c) => (
                    <option key={c}>{c}</option>
                ))}
                </select>
            </div>
        )
    }

    console.log(variableSummary)



    return(<p>Sorry guys</p>)


    {/* const minYear = filterOptions.years[0]
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

    if (selectedEcosystem == "") return (<p>Please wait...</p>) */}

}