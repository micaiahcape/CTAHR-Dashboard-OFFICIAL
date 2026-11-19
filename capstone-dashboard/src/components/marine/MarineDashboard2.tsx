"use client";

import { interpolate, getContrastColor } from "../shared/helpers";
import DashboardTemplate from "../dashboard/DashboardTemplate";

export interface MarineRow{
    year: number,
    moku_key: string,
    measurements: any // change this
}

interface MarineGeoJSONProperties {
    moku_olelo: string,
    island_olelo: string,
    year: number[],
    mean_Chlorophyll_A_ESA: number[],
    mean_Chlorophyll_A_NPP: number[],
    mean_max_degree_weeks: number[],
    mean_Kd490_ESA: number[],
    mean_PAR_NASA: number[],
    mean_sea_temp: number[],
    mean_wave_height: number[]
}

interface GeoFeature {
    type: string;
    properties: Record<string, unknown>;
    geometry: unknown;
}

interface GeoJSON {
    type: string;
    features: GeoFeature[];
    properties: any,
}

interface colorThresholds {
    colors: string[],
    thresholds: number[],
    thresholdDisplays: string[],
}

export interface MarineFilterSettings {
    year: number,
    variable: string,
}

export interface MarineFilterOptions {
    years: number[],
    variable_list: string[],
}

const columnToDisplay = {
    mean_Chlorophyll_A_ESA: {disp: "Chlorophyll A (from ESA)", short: "Chlorophyll A", safeUnit: "mg/m^3", unit: <span>mg/m<sup>3</sup></span>, defaultColor: ["#c8f7cf", "#0d6619"]},
    mean_Chlorophyll_A_NPP: {disp: "Chlorophyll A (from NPP)", short: "Chlorophyll A", unit: <span>mg/m<sup>3</sup></span>, safeUnit: "mg/m^3", defaultColor: ["#c8f7cf", "#0d6619"]},
    mean_max_degree_weeks: {disp: "Coral Reef Degree Heating Weeks", short: "Degree Heating Wks", unit: <span>°C-weeks</span>, safeUnit: "°C-weeks", defaultColor: ["#f5f3c4", "#f72500"]},
    mean_Kd490_ESA: {disp: "Kd490 Turbidity (from ESA)", short: "Turbidity", unit: <span>m<sup>-1</sup></span>, safeUnit: "m^-1", defaultColor: ["#b3e8e2", "#0059ff"]},
    mean_PAR_NASA: {disp: "Photosynthetic Active Radiation (from NASA)", short: "PAR", unit: <span>mol photons m<sup>-2</sup> day<sup>-1</sup></span>, safeUnit: "mol photons m^-2 day^-1", defaultColor: ["#ffffeb", "#8800ff"]}, 
    mean_sea_temp: {disp: "Sea Temperature", short: "Temperature", unit: <span>°C</span>, safeUnit: "°C", defaultColor: ["#f5f3c4", "#f72500"]},
    mean_wave_height: {disp: "Wave Height", short: "Height", unit: <span>m</span>, safeUnit: "m", defaultColor: ["#b3e8e2", "#0059ff"]}
}

const displayToColumn = Object.fromEntries(
    Object.entries(columnToDisplay).map(([key, value]) => [value.disp, {column: key, unit: value.unit, safeUnit: value.safeUnit, shortDisplay: value.short, defaultColor: value.defaultColor}])
)

function parseMarineGeoJSON(geojson: GeoJSON) {
    const rows: MarineRow[] = []
    const variablesToMap = ["mean_Chlorophyll_A_ESA", "mean_Chlorophyll_A_NPP", "mean_max_degree_weeks", "mean_Kd490_ESA", "mean_PAR_NASA", "mean_sea_temp", "mean_wave_height"]
    for (const feat of geojson.features) {
        const f = feat.properties as unknown as MarineGeoJSONProperties
        for (let i = 0; i < f.year.length; i++) {
            const data: any = {}

            variablesToMap.forEach((e) => {
                data[e] = f[e as keyof typeof f][i]
            })

            rows.push ({
                year: Number(f.year[i]),
                moku_key: `${f.moku_olelo}_${f.island_olelo}`,
                measurements: data,
            })
        }
    }

    console.log(rows)
    return rows;
}

function establishMarineFilters(data: MarineRow[]) {
    const variables = Object.keys(data[0].measurements).map((e) => `${columnToDisplay[e as keyof typeof columnToDisplay].disp}`)
    const years = [...new Set(data.map(e => e.year))].sort((a, b) => a - b)

    const filterOptions = {
        variable_list: variables,
        years: years,
    }

    const defaultFilter = {
        variable: variables[0],
        year: years[years.length - 1],
    }

    // for ease of use
    const filterDescriptions = {
        btnVars: [],
        dropdownVars: ["variable_list"],
        singleRangeVars: ["years"],
        doubleRangeVars: [],
        displayText: {
            years: "Year",
            variable_list: "Variable to view"
        },
        correspondingVariable: {
            years: "year",
            variable_list: "variable"
        }
    }

    return { filterOptions, defaultFilter, filterDescriptions };
}

function filterMarineRows (rows: MarineRow[], filterSettings: MarineFilterSettings) {
    const filteredRows = rows.filter((row) => {
        return (filterSettings.year == -1 || row.year == filterSettings.year)
    })

    const valueByMoku: Record<string, any> = {}
    filteredRows.forEach(r => {
        const currVar = displayToColumn[filterSettings.variable as keyof typeof displayToColumn]
        
        valueByMoku[r.moku_key] = {
            value: currVar ? r.measurements[currVar.column] : -1,
            variable: currVar.column, 
            variable_display: filterSettings.variable,
            unit: currVar.unit,
        }
    })

    return valueByMoku
}

function computeColorThresholds (
    aggTotals: Record<string, any>, 
    defaultColors?: [string, string], 
    numWholeSegments: number = 2) {

    if (!defaultColors) {
        const selectedVariable = aggTotals[Object.keys(aggTotals)[0]].variable
        console.log(selectedVariable)
        defaultColors = columnToDisplay[selectedVariable as keyof typeof columnToDisplay].defaultColor as [string, string]
    }
    
    let sorted: number[]
    
    sorted = Object.values(aggTotals).map((item: any) => item.value).sort((a, b) => a - b);

    const percent1 = sorted[Math.floor(sorted.length * 0.1)]
    const percent9 = sorted[Math.floor(sorted.length * 0.9)]

    const increment = (percent9 - percent1) / numWholeSegments
    let fixed_increment = -1;
    let fixed_low_outlier = -1;

    const significant_figures = 3;
    const num_digits = String(Math.trunc(increment)).length

    if (increment < 1) {
        // if the increment is very small, allow up to two decimal places (e.g. 0.05, 0.62)
        fixed_increment = Math.ceil(increment * Math.pow(10, significant_figures)) / Math.pow(10, significant_figures)
    } else {
        fixed_increment = Math.round(increment / Math.pow(10, num_digits - significant_figures)) * Math.pow(10, num_digits - significant_figures)
    }

    if (percent9 < 1) {
        // if the increment is very small, allow up to two decimal places (e.g. 0.05, 0.62)
        fixed_low_outlier = Math.ceil(percent1 * Math.pow(10, significant_figures)) / Math.pow(10, significant_figures)
    } else {
        fixed_low_outlier = Math.round(percent1 / Math.pow(10, num_digits - significant_figures)) * Math.pow(10, num_digits - significant_figures)
    }

    // for raw numbers
    let recalc: number[] = []
    for (let i = 0; i < numWholeSegments + 1; i++) {
        recalc.push(fixed_low_outlier + i * (fixed_increment))
    }

    // for the display
    const fixedScaleDisplay = recalc.map((item: number) => {
        if (String(item).length > 6) {
            // indicating a floating point error (e.g. 0.300000000004)
            return String(item.toFixed(2))
        } else {
            return String(item)
        }
    })

    // for colors
    let colors: string[] = []
    for (let i = 0; i < recalc.length + 1; i++) {
        colors.push(interpolate(defaultColors[0], defaultColors[1], i / recalc.length))
    }

    return {colors: colors, thresholds: recalc, thresholdDisplays: fixedScaleDisplay}
}

// aggregate into GeoJSON
function aggregateGeoJSON (originalGeoJSON: any, agg: Record<string, any>) {
    const aggregatedExtentsGeoJSON = {...originalGeoJSON,
        features: originalGeoJSON?.features.map((feat: any) => {
            const key: any = `${feat.properties.moku_olelo}_${feat.properties.island_olelo}`
            return ({
                ...feat,
                properties: {
                    ...(agg[key]),
                    name: (key && `${key.split("_")[0]} (${key.split("_")[1]})`),
                }
            })
        })
    }
    return aggregatedExtentsGeoJSON
}

function marineLfTooltip (feat: any, appliedFilters: MarineFilterSettings, colorThresholds: colorThresholds) {

    const getColor = (value: number) => {
        let index = 0;
        while (value > colorThresholds.thresholds[index] && index < colorThresholds.thresholds.length) {
            index++;
        }
        return colorThresholds.colors[index];
    }

    const name = feat?.properties?.name
    const value = Number(feat?.properties?.value ?? 0)
    const unit = feat?.properties?.unit ?? ""
    const bgcolor = value != 0 ? getColor(value) : "#b5bdc9"

    return (
        <div>
            <p style={{ fontSize: "15px", fontWeight: "bold", paddingBottom: "3%" }}>{name}</p>
            <div style={{display: "flex"}}>
                <p style={{margin: "auto 6px auto 0"}}>{appliedFilters.variable}: <b style={{backgroundColor: `${bgcolor}`, color: `${getContrastColor(bgcolor)}`, padding: "1px 2px", fontSize: "15px"}}>{value} {unit}</b></p>
            </div>
            <p>Year: {appliedFilters.year}</p>
        </div>
    )
}

function getMarineTitles (appliedFilters: Record<string, any>) {
    const mapTitle = <p>Marine ecosystem data, <span className="summary-highlight">{appliedFilters.variable} ({displayToColumn[appliedFilters.variable].unit})</span>: {appliedFilters.year}</p>
    const legendTitle = <p>{displayToColumn[appliedFilters.variable].shortDisplay} ({displayToColumn[appliedFilters.variable].unit})</p>

    return { mapTitle, legendTitle }
}

export default function MarineDashboard2 () {
    const marineFunctions = {
        parseGeoJSONFn: parseMarineGeoJSON,
        establishFilterFn: establishMarineFilters,
        filterFn: filterMarineRows,
        colorCalculationFn: computeColorThresholds,
        newGeoJSONFn: aggregateGeoJSON,
    }

    return (<DashboardTemplate
        geoJSONPath="/mokuextentsdata/USED_IN_PROJECT/2026_10_23_marine_conditions_byMoku.geojson"
        uniqFunctions={marineFunctions} 
        getToolTip={marineLfTooltip}
        getTitle={getMarineTitles}
    />)
}