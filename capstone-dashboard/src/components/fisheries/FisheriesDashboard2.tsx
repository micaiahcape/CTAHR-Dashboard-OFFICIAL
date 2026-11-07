import { interpolate, formatCurrency, getContrastColor } from "../shared/helpers";
import DashboardTemplate from "../dashboard/DashboardTemplate";
import { useState } from "react";

export interface DataRow {
  	year: number;
	area_name: string;
  	species_group: string;
  	ecosystem_type: string;
  	exchange_value: number;
	county: string;
}

export interface FisheryFilterSettings {
	startYear: number,
	endYear: number,
	county: string,
	species: string,
	ecosystem: string,
}

interface FisheryGeoEntry {
    type: string,
    properties: Record<string, any>,
    geometry: any
}

interface colorThresholds {
    colors: string[],
    thresholds: number[],
}

/* ======== Data processing helper functions that will be passed into DashboardTemplate.tsx ======== */

function parseFisheriesGeoJSON(geojson: any): DataRow[] {
    const rows: DataRow[] = [];
    for (const feat of geojson.features) {
        const p: any = feat.properties;

        // little cheat here; if the datatype is comm the "island_olelo" key will not exist
        const name: string = p.area_id ? String(p.area_id) : String(p.island_olelo)

        const toArr = (v: any): any[] => (Array.isArray(v) ? v : [v]);
        const years = toArr(p.year).map(Number);
        const values = toArr(p.exchange_value).map(Number);
    
        for (let i = 0; i < years.length; i++) {
            const val = Number(values[i]) || 0;
            if (val <= 0 || p.species_group[i] === "All Species" || p.ecosystem_type[i] === "All Ecosystems") continue;
            // to prevent double counting, we skip rows that are "All Species" or "All Ecosystems." These values are broken down by specific species and specific ecosystems, which we could use to tally up.
            
            rows.push({
                year: Number(years[i]),
                area_name: name,
                county: p.county_olelo,
                species_group: (typeof p.species_group === "string" ? p.species_group : p.species_group[i]),
                ecosystem_type: (typeof p.ecosystem_type === "string" ? p.ecosystem_type : p.ecosystem_type[i]),
                exchange_value: val,
            });
        }
    }

    return rows;
}


function establishFisheryFilters (data: DataRow[]) {
    const species_list = [...new Set(data.map((r) => r.species_group))].sort()
    const ecosystem_list = [...new Set(data.map((r) => r.ecosystem_type))].sort()
    const counties_list = [...new Set(data.map((d) => d.county))].sort()
    const year_list = [...new Set(data.map((d) => d.year))].sort((a, b) => a - b)

    if (species_list.length > 1) {
        species_list.unshift("All Species");
    }

    if (ecosystem_list.length > 1) {
        ecosystem_list.unshift("All Ecosystems");
    }

    const filterOptions = {
        species_list: species_list,
        ecosystem_list: ecosystem_list,
        counties_list: counties_list,
        years: year_list,
    }

    const defaultFilter = {
        startYear: year_list[0],
        endYear: year_list[year_list.length - 1],
        county: "",
        species: "All Species",
        ecosystem: "All Ecosystems",
    }

    return { filterOptions, defaultFilter }
}

// returns an object in the format of {location1: value1, location2: value2, ... }
function filterFisheryRows (rows: DataRow[], filterSettings: FisheryFilterSettings) {
    const filteredRows =  rows.filter((row) => {
        return (
            (filterSettings.startYear === null || row.year >= filterSettings.startYear) &&
            (filterSettings.endYear === null || row.year <= filterSettings.endYear) &&
            (filterSettings.county === "" || row.county === filterSettings.county) &&
            // when it's "All Species" or "All Ecosystems", the code "short circuits" and returns all species rows and/or ecosystem rows.
            (filterSettings.species === "All Species" || row.species_group === filterSettings.species) &&
            (filterSettings.ecosystem === "All Ecosystems" || row.ecosystem_type === filterSettings.ecosystem)
        )
    })

    // aggregate
    const filteredTotalsById: Record<string, number> = {};
	filteredRows.forEach((row) => {
		filteredTotalsById[row.area_name] = (filteredTotalsById[row.area_name] || 0) + row.exchange_value;
	});

    return filteredTotalsById;
}

// returns an object in the format of {colors: [list of colors], thresholds: [list of values], ... }
function computeColorThresholds (
    aggTotals: Record<string, number>, 
    defaultColors: [string, string] = ["#f7fbff", "#ff5100"], 
    numWholeSegments: number = 2) {
    
    let sorted: number[]
    
    sorted = Object.values(aggTotals).sort((a, b) => a - b);
    const percent1 = Math.round(sorted[Math.floor(sorted.length * 0.1)])
    const percent9 = Math.round(sorted[Math.floor(sorted.length * 0.9)])

    const increment = (percent9 - percent1) / numWholeSegments

    const increment_length = Math.trunc(increment).toString().length;
    const digits_to_round = increment_length - 2

    const fixed_increment = Math.round(increment / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)
    let fixed_low_outlier = Math.round(percent1 / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)

    if (fixed_low_outlier <= 0) {
        fixed_low_outlier = Math.pow(10, digits_to_round)
    }

    // for raw numbers
    let recalc: number[] = []
    for (let i = 0; i < numWholeSegments + 1; i++) {
        recalc.push(fixed_low_outlier + i * (fixed_increment))
    }

    // for displaying on the legend
    const finalValue = recalc[numWholeSegments]
    const finalUnit = (finalValue > 1000000 ? "M" : "K")
    const fixedScaleDisplay: string[] = recalc.map((item: number): string => {
        if (item < 100000 || (item < 1000000 && finalUnit == "K")) {
            return (item / 1000) + "K"
        } else if (item > 100000 || (item < 1000000 && finalUnit == "M")) {
            return (item / 1000000) + "M"
        }
        return ""
    })

    // calculate the colors that correspond to the numbers
    let colors: string[] = []
    for (let i = 0; i < recalc.length + 1; i++) {
        colors.push(interpolate(defaultColors[0], defaultColors[1], i / recalc.length))
    }

    return {colors: colors, thresholds: recalc, thresholdDisplays: fixedScaleDisplay}
}

// standardize everything to value
function aggregateGeoJSON (originalGeoJSON: any, agg: Record<string, any>) {
    console.log("The original GeoJSON is: ")
    console.log(originalGeoJSON)
    return ({
        ...originalGeoJSON,
        features: originalGeoJSON?.features.map((feature: any) => {
            const key: string = feature.properties.area_id ? String(feature.properties.area_id) : String(feature.properties.island_olelo)
            return {
                ...feature,
                properties: {
                    name: key,
                    value: agg[key] || 0,
                },
            };
        }).filter((feature: any) =>
            (feature.properties.value as number) > 0
        ),
    });
}

/* ======== Functions that will return a customized display for DashboardTemplate.tsx ======== */

function fisheriesLfTooltip (feat: any, appliedFilters: FisheryFilterSettings, colorThresholds: colorThresholds) {

    const getColor = (value: number) => {
        let index = 0;
        while (value > colorThresholds.thresholds[index] && index < colorThresholds.thresholds.length) {
            index++;
        }
        return colorThresholds.colors[index];
    }

    const value = Number(feat?.properties?.value ?? 0)
    let formattedValue: string = formatCurrency(value)
    const bgcolor = value != 0 ? getColor(value) : "#b5bdc9"

    return (
        <div>
            <p style={{ fontSize: "15px", fontWeight: "bold", paddingBottom: "3%" }}>{feat.properties.name}</p>
            <p>Exchange Value: <b style={{backgroundColor: `${bgcolor}`, color: `${getContrastColor(bgcolor)}`, padding: "1px 2px", fontSize: "15px"}}>{formattedValue}</b></p>
            <p>Year: {appliedFilters.startYear ?? "start"} - {appliedFilters.endYear ?? "end"}</p>
            <p>Species: {appliedFilters.species || "All"}</p>
            <p>Ecosystem: {appliedFilters.ecosystem || "All"}</p>
        </div>
    )
}

function fisheryTitle (appliedFilters: FisheryFilterSettings) {
    return (
        <p>Fisheries data, with <span className="summary-highlight">{(!appliedFilters.species || appliedFilters.species === "All Species") ? "ALL" : appliedFilters.species.toLocaleLowerCase()}</span> species and <span className="summary-highlight">{(!appliedFilters.ecosystem || appliedFilters.ecosystem === "All Ecosystems") ? "ALL" : appliedFilters.ecosystem.toLocaleLowerCase()}</span> ecosystems: {appliedFilters.startYear}-{appliedFilters.endYear}</p>
    )
}

export default function FisheriesDashboard2 ({dataType}: {dataType: "noncomm" | "comm"}) {
    const fisheryFunctions = {
        parseGeoJSONFn: parseFisheriesGeoJSON,
        establishFilterFn: establishFisheryFilters,
        filterFn: filterFisheryRows,
        colorCalculationFn: computeColorThresholds,
        newGeoJSONFn: aggregateGeoJSON,
    }

    const toFetch = dataType === "noncomm" ? "/fisheriesdata/USED_IN_PROJECT/10_14_2026_noncomm_EV_byIsland.geojson" : "/fisheriesdata/USED_IN_PROJECT/10_14_2026_comm_EV_byCatchmentArea.geojson"
    console.log("datatype is: " + dataType)
    console.log(toFetch)

    return (<DashboardTemplate 
        geoJSONPath={toFetch} 
        uniqFunctions={fisheryFunctions} 
        getToolTip={fisheriesLfTooltip}
        getTitle={fisheryTitle}
    />)
}