"use client";

import React, { useMemo } from "react";
import ReactSlider from "react-slider";
import styles from "@/css/filterMenu.module.css";
import { FilterDescription } from "../dashboard/DashboardTemplate";

interface FilterProps {
    filterOptions: Record<string, any[]>,
    currentFilter: Record<string, any>,
    filterDescriptions: FilterDescription
    onChangeFilter: (obj: Record<string, any>) => void;
}

interface IndividualFilterDescription {
    options: any[],
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

    console.log(variableSummary)

    function changeFilter(key: string, value: any) {
        const currentFilterCopy = {...currentFilter}
        currentFilterCopy[key] = value
        onChangeFilter(currentFilterCopy)
    }

    function Btns (filterInfo: IndividualFilterDescription) {
        const variableToChange = filterInfo.correspondingVariable
        return(
            <div className={styles["rp-section"]}>
                <div className={styles["filter-label"]}>{filterInfo.displayText}</div>
                <div className={styles["button-group"]}>
                {filterInfo.options.map((e) => (
                    <button 
                    key={e} 
                    className={`${styles["filter-btn"]} ${currentFilter[variableToChange] === e ? styles.active : ""}`} 
                    onClick={() => {changeFilter(variableToChange, e)}}>{e}</button>
                ))}
                </div>
            </div>
        )
    }

    function DropDowns (filterInfo: IndividualFilterDescription) {
        const variableToChange = filterInfo.correspondingVariable
        return(
            <div className={styles["rp-section"]}>
                <div className={styles["filter-label"]}>{filterInfo.displayText}</div>
                <select className={styles["filter-select"]} value={currentFilter[variableToChange]}onChange={(e) => {changeFilter(variableToChange, e.target.value)}}> 
                {filterInfo.options.map((c) => (
                    <option key={c}>{c}</option>
                ))}
                </select>
            </div>
        )
    }

    function YearSlider (filterInfo: IndividualFilterDescription, variable: string) {
        const variableToChange = filterInfo.correspondingVariable
        const isNotRange = filterInfo.variableType == "singleRangeVars"

        const minYear = filterOptions[variable][0]
        const maxYear = filterOptions[variable][filterOptions[variable].length - 1]
        
        const currentYear = 
        isNotRange ? currentFilter[variableToChange] : [currentFilter[filterInfo.correspondingVariable[0]], currentFilter[filterInfo.correspondingVariable[1]]]

        const currentYearDisplay = 
        isNotRange ? currentFilter[variableToChange] : `${currentFilter[filterInfo.correspondingVariable[0]]}-${currentFilter[filterInfo.correspondingVariable[1]]}`

        const calculatedMarginLeft = (() => {
            const range = maxYear - minYear;
            const centerYear = 
            isNotRange ? currentYear : (currentFilter[filterInfo.correspondingVariable[0]] + currentFilter[filterInfo.correspondingVariable[1]]) / 2

            const resultantPercent = ((centerYear - minYear) / range) * 100;

            if (resultantPercent > 85) {
                return "85%";
            } else if (resultantPercent < 15) {
                return "15%";
            }

            return (resultantPercent + "%")
            
        }) ();

        const singleYearUpdateFn = (val: number) => {
            changeFilter(variableToChange, val)
        }

        const multiYearUpdateFn = (val: [number, number], thumbIndex: number) => {
            changeFilter(filterInfo.correspondingVariable[thumbIndex], val[thumbIndex])
        }

        return (
            <div className={styles["rp-section"]}>
                <div className={styles["filter-label"]}>Year Range</div>
                <div style={{width: "100%", position: "relative", marginBottom: "2%"}}>
                    <div className={styles["sliderValueHolder"]} style={{ marginLeft: calculatedMarginLeft }}>{currentYearDisplay}</div>
                </div>
                
                <ReactSlider 
                value={currentYear}
                minDistance={0}
                step={Number(filterInfo.options[1]) - Number(filterInfo.options[0])}
                pearling={true}
                min={minYear}
                max={maxYear}
                className={styles["horizontal-slider"]}
                thumbClassName={styles["year-thumb"]}
                trackClassName={styles["year-track"]}
                onChange={isNotRange ? singleYearUpdateFn : multiYearUpdateFn} />
            </div>
        )
    }

    return(
    <>
        <p style={{fontSize: "125%", fontWeight: "bold"}}>Applied Filters</p>
        {Object.keys(variableSummary).map(k => {
            const varType = variableSummary[k].variableType
            if (varType == "btnVars") {
                return Btns(variableSummary[k])
            } else if (varType == "dropdownVars") {
                return DropDowns(variableSummary[k])
            } else if (varType == "singleRangeVars" || varType == "doubleRangeVars") {
                return YearSlider(variableSummary[k], k)
            }

        })}
    </>)
}