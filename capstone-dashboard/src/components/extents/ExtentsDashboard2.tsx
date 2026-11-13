import { interpolate, formatCurrency, getContrastColor } from "../shared/helpers";
import DashboardTemplate from "../dashboard/DashboardTemplate";
import { useState } from "react";

interface DataRow {
    year: number;
    moku_olelo: string;
    island_olelo: string;
    moku_key: string; // in the format of `moku_olelo (island_olelo)` — globally unique
    realm: string;
    ecosystem_type: string;
    area_km2: number;
}

interface TerrestrialGeoJSONProperties {
    realm: string,
    moku_olelo: string,
    island_olelo: string,
    ecosystem_type: string[],
    area_km2: number[],
    year: number[],
    total_area_km2: number
}

interface ExtentsFilterSettings {
    startYear: number,
    endYear: number,
    ecosystem: string, 
}

interface colorThresholds {
    colors: string[],
    thresholds: number[],
    thresholdDisplays: string[],
}

/* ======== Data processing helper functions that will be passed into DashboardTemplate.tsx ======== */

function parseExtentsGeoJSON(geojson: any) {
    const rows: DataRow[] = []
    for (const feat of geojson.features) {
        const f = feat.properties as unknown as TerrestrialGeoJSONProperties
        // thank you AI idk how to fix the above line
        for (let i = 0; i < f.year.length; i++) {
            rows.push ({
                year: Number(f.year[i]),
                moku_olelo: String(f.moku_olelo ?? ""),
                island_olelo: String(f.island_olelo ?? ""),
                moku_key: `${f.moku_olelo}_${f.island_olelo}`, // combination of moku and island creates a primary key
                realm: f.realm,
                ecosystem_type: f.ecosystem_type[i],
                area_km2: Number(f.area_km2[i]) || 0,
            })
        }
    }

    return rows;
}

function establishExtentsFilters(data: DataRow[]) {
    const years = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b)
    const ecosystems = [...new Set(data.map((r) => r.ecosystem_type))].sort()
    const filterOptions = {
        ecosystem_list: ecosystems,
        years: years,
    }

    const defaultFilter = {
        startYear: years[0],
        endYear: years[years.length - 1],
        ecosystem: ecosystems[0],
    }

    // for ease of use
    const filterDescriptions = {
        btnVars: ["ecosystem_list"],
        dropdownVars: [],
        singleRangeVars: [],
        doubleRangeVars: ["years"],
        displayText: {
            years: "Year",
            ecosystem_list: "Ecosystem type",
        },
        correspondingVariable: {
            years: ["startYear", "endYear"],
            ecosystem_list: "ecosystem",
        }              
    }

    return { filterOptions, defaultFilter, filterDescriptions };
}

// returns an object in the format of {location1: value1, location2: value2, ... }
function filterExtentsRows (rows: DataRow[], filterSettings: ExtentsFilterSettings) {
    const filteredRows =  rows.filter((row) => {
        return (
            (filterSettings.startYear == -1 || row.year >= filterSettings.startYear) &&
            (filterSettings.endYear == -1 || row.year <= filterSettings.endYear) &&
            (row.ecosystem_type === filterSettings.ecosystem)
        )
    })

    // aggregate
    const terrestrialChangesByMoku: any = {};
    if (filterSettings.startYear === filterSettings.endYear && filterSettings.startYear < 0) {
        // view for just that year
    } else {
        filteredRows.forEach(i => {
            const o = terrestrialChangesByMoku[i.moku_key] ? terrestrialChangesByMoku[i.moku_key] : {}
            o[i.year] = i.area_km2
            terrestrialChangesByMoku[i.moku_key] = o;
        })
    }

    Object.keys(terrestrialChangesByMoku).forEach((k) => {
        const first = terrestrialChangesByMoku[k][String(filterSettings.startYear)] 
        const last = terrestrialChangesByMoku[k][String(filterSettings.endYear)]
        const abs_change = last - first
        terrestrialChangesByMoku[k].absolute_change = abs_change
        terrestrialChangesByMoku[k].relative_change = first != 0 ? (abs_change / first) * 100 : 0
        terrestrialChangesByMoku[k].firstYearValue = first;
        terrestrialChangesByMoku[k].lastYearValue = last;
    })

    return terrestrialChangesByMoku;
}

// returns an object in the format of {colors: [list of colors], thresholds: [list of values], ... }
function computeColorThresholds (
    agg: Record<string, any>, 
    defaultColors: [string, string] = ["#0362fc", "#ff3300"], 
    numWholeSegments: number = 4) {
    
    let sorted: number[]

    sorted = Object.values(agg).map((e: any) => e.relative_change).sort((a, b) => a - b);
    // restrict to 1 decimal places in terms of %.
    const percent1 = Math.round(sorted[Math.floor(sorted.length * 0.1)] * 10) / 10
    const percent9 = Math.round(sorted[Math.floor(sorted.length * 0.9)] * 10) / 10
    let lower = percent1
    let upper = percent9
    if (percent1 < 0 && percent9 > 0) {
        if (Math.abs(percent1) > Math.abs(percent9)) {
            upper = 0 - percent1
        } else {
            lower = 0 - percent9
        }
    }

    const increment = (upper - lower) / numWholeSegments

    // for raw numbers - truncate to 1 decimal palce
    let recalc: number[] = []
    for (let i = 0; i < numWholeSegments + 1; i++) {
        recalc.push(Math.round((lower + i * (increment)) * 10) / 10)
    }

    // for displaying on the legend
    const fixedScaleDisplay: string[] = recalc.map((item: number): string => `${item}%`)

    // calculate the colors that correspond to the numbers
    let colors: string[] = []
    const len = recalc.length
    for (let i = 0; i < recalc.length + 1; i++) {
        if (i >= len / 2){
            colors.push(interpolate("#b5bdc9", defaultColors[1], (i - Math.floor(len / 2)) / Math.ceil(len / 2)))
        } else {
            colors.push(interpolate("#b5bdc9", defaultColors[0], (Math.ceil(len / 2) - i) / Math.ceil(len / 2)))
        }
    }

    return {colors: colors, thresholds: recalc, thresholdDisplays: fixedScaleDisplay}
}

// aggregate into GeoJSON
function aggregateGeoJSON(originalGeoJSON: any, agg: Record<string, any>) {
    const aggregatedExtentsGeoJSON = {...originalGeoJSON,
        features: originalGeoJSON?.features.map((feat: any) => {
            const key = `${feat.properties.moku_olelo}_${feat.properties.island_olelo}`
            const specific_moku = agg[key]
            return ({
                ...feat,
                properties: {
                    name: key,
                    relative_change: specific_moku.relative_change,
                    value: specific_moku.relative_change, // for coloring purposes
                    absolute_change: specific_moku.absolute_change,
                    year1Value: specific_moku.firstYearValue,
                    year2Value: specific_moku.lastYearValue,
                }
            })
        })
    }
    return aggregatedExtentsGeoJSON
}

/* ======== Functions that will return a customized display for DashboardTemplate.tsx ======== */

function extentsLfTooltip (feat: any, appliedFilters: ExtentsFilterSettings, colorThresholds: colorThresholds) {

    const getColor = (value: number) => {
        let index = 0;
        while (value > colorThresholds.thresholds[index] && index < colorThresholds.thresholds.length) {
            index++;
        }
        return colorThresholds.colors[index];
    }

    const name = feat?.properties?.name
    const formattedName = name ? `${name.split('_')[0]} (${name.split('_')[1]})` : "NONAME"
    const value = Number(feat?.properties?.relative_change ?? 0)
    const bgcolor = value != 0 ? getColor(value) : "#b5bdc9"

    let formattedValue;
    if (value > 0) {
        formattedValue = `▲ ${value.toFixed(2)}%`
    } else if (value < 0) {
        formattedValue = `▼ ${(0-value).toFixed(2)}%`
    } else if (value == 0) {
        formattedValue = `No Change`
    }

    return (
        <div>
            <p style={{ fontSize: "15px", fontWeight: "bold", paddingBottom: "3%" }}>{formattedName}</p>
            <p>{appliedFilters.startYear} area: {feat.properties.year1Value} km<sup>2</sup></p>
            <div style={{ display: "flex" }}>
                <p style={{ margin: "auto 6px auto 0" }}>{appliedFilters.endYear} area: {feat.properties.year2Value} km<sup>2</sup></p>
                <b style={{ backgroundColor: `${bgcolor}`, color: `${getContrastColor(bgcolor)}`, padding: "1px 2px", fontSize: "15px" }}>{formattedValue}</b>
            </div>
            <p>Ecosystem: {appliedFilters.ecosystem || "All"}</p>
        </div>
    )
}

function fisheryTitle (appliedFilters: ExtentsFilterSettings) {
    return (
        <p>Extents data, <span className="summary-highlight">{appliedFilters.ecosystem}</span>: from {appliedFilters.startYear}-{appliedFilters.endYear}</p>
    )
}

export default function ExtentsDashboard2 () {
    const fisheryFunctions = {
        parseGeoJSONFn: parseExtentsGeoJSON,
        establishFilterFn: establishExtentsFilters,
        filterFn: filterExtentsRows,
        colorCalculationFn: computeColorThresholds,
        newGeoJSONFn: aggregateGeoJSON,
    }

    return (<DashboardTemplate 
        geoJSONPath="/mokuextentsdata/USED_IN_PROJECT/2026_10_07_terrestrial_extents_byMoku.geojson"
        uniqFunctions={fisheryFunctions} 
        getToolTip={extentsLfTooltip}
        getTitle={fisheryTitle}
    />)
}