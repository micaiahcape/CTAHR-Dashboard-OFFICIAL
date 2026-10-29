"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import MarineFilterMenu from "./MarineFilterMenu";
import CompactDataView from "../extents/CompactDataView";
// @ts-ignore
import "../dashboard/dashboard.css";

const Map = dynamic(() => import("../map/Map"), { ssr: false });


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

interface DashboardProps {
    dataset: string,
}

export interface MarineFilterSettings {
    year: number,
    variable?: string,
}

export interface MarineFilterOptions {
    years: number[],
    variable_list: string[], // for marine
}

function parseExtentsGeoJSON(geojson: GeoJSON) {

    const rows: MarineRow[] = []
    const variablesToMap = ["mean_Chlorophyll_A_ESA", "mean_Chlorophyll_A_NPP", "mean_max_degree_weeks", "mean_Kd490_ESA", "mean_PAR_NASA", "mean_sea_temp", "mean_wave_height"]
    for (const feat of geojson.features) {
        const f = feat.properties as unknown as MarineGeoJSONProperties
        for (let i = 0; i < f.year.length; i++) {
            const data: any = {}

            variablesToMap.forEach((e) => {
                data[e] = f[e][i]
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

export default function MarineDashboard ({ dataset } : DashboardProps) {
    const [geoData, setGeoData] = useState<GeoJSON | null>(null);
    const [marineGeoJSON, setMarineGeoJSON] = useState<GeoJSON | null>(null);

    // for the selected/clicked polygon.
    const [selectedArea, setSelectedArea] = useState("");
    const [activeTab, setActiveTab] = useState<"filter" | "viz">("filter");

    // Fisheries filters
    const nullFilter: MarineFilterSettings = {year: -1}
    const [marineFilter, setMarineFilter] = useState<MarineFilterSettings>(nullFilter)

    const columnToDisplay = {
        mean_Chlorophyll_A_ESA: "Chlorophyll A (from ESA)",
        mean_Chlorophyll_A_NPP: "Chlorophyll A (from NPP)",
        mean_max_degree_weeks: "Coral Degree-Weeks", 
        mean_Kd490_ESA: "Kd490 Turbidity (from ESA)",
        mean_PAR_NASA: "Photosynthetic Active Radiation (from NASA)", 
        mean_sea_temp: "Sea Temperature",
        mean_wave_height: "Wave Height"
    }

    const displayToColumn = Object.fromEntries(
        Object.entries(columnToDisplay).map(([key, value]) => [value, key])
    )

    // only runs on mount.
    useEffect(() => {
        async function loadExtents() {
            const res2 = await fetch("/mokuextentsdata/USED_IN_PROJECT/2026_10_23_marine_conditions_byMoku.geojson");
            const geo2 = await res2.json();
            setMarineGeoJSON(geo2)
        }

        loadExtents();
    }, []);

    const marineRowData = useMemo(() => {
        return marineGeoJSON ? parseExtentsGeoJSON(marineGeoJSON) : []
    }, [marineGeoJSON])

    function establishFilterRange(data: MarineRow[]) {
        if (data.length <= 0) return {years: [0, 1]}

        return ({
            variable_list: Object.keys(data[0].measurements).map((e) => columnToDisplay[e]),
            years: [...new Set(data.map(e => e.year))].sort((a, b) => a - b),
        })
    }

    const marineFilterOptions = useMemo(() => establishFilterRange(marineRowData), [marineRowData])

    if (marineRowData.length == 0) return <div>Loading extents...</div>;

    // ======== if data isn't loaded, it short circuits here. ========

    // assign the default filter values based on the computed filter options.
    function getDefaultFilterValues(filterList: any) {
        return ({
            year: filterList.years[filterList.years.length - 1],
            variable: filterList.variable_list[0]
        })
    }

    // While the dataset is being processed, "startYear" has a placeholder value of -1. Initialize the filters to their default values once the dataset is processed.

    if (marineFilter.year < 0) {
        setMarineFilter(getDefaultFilterValues(marineFilterOptions))
    }

    if (marineFilter.year < 0) return <div>Loading filter values...</div>

    // ======== actual filtering logic below. ========

    // function that takes from the child component
    const handleFilterChange = (new_filter: MarineFilterSettings) => {
        setMarineFilter({...new_filter})
    }

    // also gets called from the child component (the sidebar.)
    const resetFilter = () => {
        setSelectedArea("");
        setMarineFilter(getDefaultFilterValues(marineFilterOptions))
    }

    // filters all rows according to the filter.
    const filteredRows = (() => {
        // very EZ
        return marineRowData.filter((row) => {
            return (marineFilter.year == -1 || row.year == marineFilter.year)
        })
    }) ();

    // ======== Transform the filtered data, merge it back to GeoJSON and compute the color thresholds. ========

    console.log(marineFilterOptions)
    console.log(filteredRows)

    const valueByMoku: Record<string, any> = {}

    filteredRows.forEach(r => {
        const currVar = displayToColumn[marineFilter.variable as keyof typeof displayToColumn]
        
        valueByMoku[r.moku_key] = currVar && r.measurements[currVar]
    })

    // aggregate into GeoJSON
    function aggregateGeoJSON(originalGeoJSON: GeoJSON | null) {
        const currVar = displayToColumn[marineFilter.variable as keyof typeof displayToColumn]

        const aggregatedExtentsGeoJSON = {...originalGeoJSON,
            features: originalGeoJSON?.features.map(feat => {
                const key: any = `${feat.properties.moku_olelo}_${feat.properties.island_olelo}`
                return ({
                    ...feat,
                    properties: {
                        value: valueByMoku[key],
                        variable: currVar, 
                        variable_display: marineFilter.variable,
                        name: (key && `${key.split("_")[0]} (${key.split("_")[1]})`),
                    }
                })
            })
        }
        return aggregatedExtentsGeoJSON
    }

    const activeGeoData = aggregateGeoJSON(marineGeoJSON)

    console.log(activeGeoData)

	const computedColorThresholds = (() => {
		let sorted: number[]
		sorted = Object.values(valueByMoku).sort((a, b) => a - b);
		const percent1 = sorted[Math.floor(sorted.length * 0.1)]
		const percent9 = sorted[Math.floor(sorted.length * 0.9)]
		return [percent1, percent9]
	}) ();

    console.log(valueByMoku)
    console.log(computedColorThresholds)

    // this one is duplicated - can refactor
    const handleAreaClick = (areaId: string) => {
        const next = selectedArea === areaId ? "" : areaId;
        setSelectedArea(next);
        if (next !== "") setActiveTab("viz");
    };

    const currentFilter = marineFilter
    const currentFilterOptions = marineFilterOptions

    return (
        <div className="dashboard-main">
            {/* Map */}
            <div className="central-panel">
                <div className="summary-display">
                    <p>Marine conditions: <span className="summary-highlight">{currentFilter.variable}</span>, {currentFilter.year}</p>
                </div>

                {activeGeoData && 
                <Map
                    mapType={dataset}
                    layerType="extents"
                    geoData={activeGeoData}
                    appliedFilters={currentFilter}
                    selectedArea={selectedArea}
                    outliers={computedColorThresholds} 
                    onCountyClick={handleAreaClick}
                />}
            </div>
        
            {/* Right panel */}
            <div className="right-panel">

                {/* Tab header */}
                <div className="right-panel-tabs">
                    <button className={`rp-tab ${activeTab === "filter" ? "active" : ""}`} 
                    onClick={() => setActiveTab("filter")}>Filter</button>
                    <button className={`rp-tab ${activeTab === "viz" ? "active" : ""}`} onClick={() => setActiveTab("viz")}>Data View</button>
                </div>

                <div style={{padding: "5% 5%"}}>
                    {/* ── FILTER TAB ── */}
                    {activeTab === "filter" && (
                        <MarineFilterMenu
                            key={dataset} 
                            filterOptions={currentFilterOptions}
                            currentFilter={currentFilter}
                            onChangeFilter={handleFilterChange}
                        />
                    )}

                    {/* ── VIZ TAB ── */}
                    {activeTab === "viz" && (<p>Nothing here yet :D</p>)}
                </div>
            </div>
        </div>
    );

}