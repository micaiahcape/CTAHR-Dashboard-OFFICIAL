"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import ExtentsFilterMenu from "./ExtentsFilterMenu";
import CompactDataView from "./CompactDataView";
// @ts-ignore
import "../dashboard/dashboard.css";

const Map = dynamic(() => import("../map/Map"), { ssr: false });

export interface ExtentsRow {
    year: number;
    moku_olelo: string;
    island_olelo: string;
    moku_key: string; // in the format of `moku_olelo (island_olelo)` — globally unique
    realm: string;
    ecosystem_type: string;
    area_km2: number;
}

export interface MarineRow{
    year: number,
    moku_key: string,
    measurements: any // change this
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

export interface ExtentsFilterSettings {
    startYear: number,
    endYear?: number,
    ecosystem?: string, // for terrestrial
}

export interface ExtentsFilterOptions {
    ecosystem_list?: string[], // for terrestrial
    years: number[],
}

function parseExtentsGeoJSON(geojson: GeoJSON, datatype: string) {

    const rows: ExtentsRow[] = []
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

export default function ExtentsDashboard ({ dataset } : DashboardProps) {
    const [geoData, setGeoData] = useState<GeoJSON | null>(null);

    // holds the raw GeoJSON files.
    const [terrestrialGeoJSON, setTerrestrialGeoJSON] = useState<GeoJSON | null>(null);

    // for the selected/clicked polygon.
    const [selectedArea, setSelectedArea] = useState("");
    const [activeTab, setActiveTab] = useState<"filter" | "viz">("filter");

    // Fisheries filters
    const nullFilter: ExtentsFilterSettings = {startYear: -1, endYear: -1}
    const [terrestrialFilter, setTerrestrialFilter] = useState<ExtentsFilterSettings>(nullFilter)

    // only runs on mount.
    useEffect(() => {
        async function loadExtents() {
            const res = await fetch("/mokuextentsdata/USED_IN_PROJECT/2026_10_07_terrestrial_extents_byMoku.geojson");
            const geo = await res.json();
            setTerrestrialGeoJSON(geo)
        }

        loadExtents();
    }, []);

    // parse the GeoJSON into rows.
    const terrestrialRowData = useMemo(() => {
        return terrestrialGeoJSON ? parseExtentsGeoJSON(terrestrialGeoJSON, "terrestrial") : []
    }, [terrestrialGeoJSON])

    function establishFilterRange(data: ExtentsRow[] | MarineRow[]) {
        if (data.length <= 0) return {years: [0, 1]}

        return ({
            ecosystem_list: [...new Set(data.map((r) => r.ecosystem_type))].sort(),
            years: [...new Set(data.map((d) => d.year))].sort((a, b) => a - b),
        }) 
    }

    const terrestrialFilterOptions = useMemo(() => establishFilterRange(terrestrialRowData), [terrestrialRowData])


    if (terrestrialRowData.length == 0) return <div>Loading extents...</div>;

    // ======== if data isn't loaded, it short circuits here. ========

	// assign the default filter values based on the computed filter options.
	function getDefaultFilterValues(filterList: any) {
        return ({
            startYear: filterList.years[0],
            endYear: filterList.years[filterList.years.length - 1],
            ecosystem: filterList.ecosystem_list[0],
        })
	}

	// While the dataset is being processed, "startYear" has a placeholder value of -1. Initialize the filters to their default values once the dataset is processed.
	if (terrestrialFilter.startYear < 0) {
		setTerrestrialFilter(getDefaultFilterValues(terrestrialFilterOptions))
	}

    if (terrestrialFilter.startYear < 0) return <div>Loading filter values...</div>;

    // ======== actual filtering logic below. ========

	// function that takes from the child component
    const handleFilterChange = (new_filter: ExtentsFilterSettings) => {
        setTerrestrialFilter({...new_filter})
    }

    // also gets called from the child component (the sidebar.)
	const resetFilter = () => {
		setSelectedArea("");
		setTerrestrialFilter(getDefaultFilterValues(terrestrialFilterOptions))
	}

    // filters all rows according to the filter.
    const filteredRows = (() => {
        let rows: ExtentsRow[]
        let filter: ExtentsFilterSettings = nullFilter;

        /*
        if (dataset === "comm") {
            rows = commRowData
            filter = commFilter
        } else {
            rows = nonCommRowData
            filter = nonCommFilter
        }*/

        rows = terrestrialRowData
        filter = terrestrialFilter

        console.log("The current filter is: ")
        console.log(JSON.stringify(filter))

        return rows.filter((row) => {
            return (
                (filter.startYear == -1 || row.year >= filter.startYear) &&
                (filter.endYear == -1 || row.year <= filter.endYear) &&
                (row.ecosystem_type === filter.ecosystem)
            )
        })
    }) ();

    // ======== Transform the filtered data, merge it back to GeoJSON and compute the color thresholds. ========

    const terrestrialChangesByMoku: any = {};
    if (terrestrialFilter.startYear === terrestrialFilter.endYear && terrestrialFilter.startYear < 0) {
        // view for just that year
    } else {
        filteredRows.forEach(i => {
            const o = terrestrialChangesByMoku[i.moku_key] ? terrestrialChangesByMoku[i.moku_key] : {}
            o[i.year] = i.area_km2
            terrestrialChangesByMoku[i.moku_key] = o;
        })
    }

    Object.keys(terrestrialChangesByMoku).forEach((k) => {
        const first = terrestrialChangesByMoku[k][String(terrestrialFilter.startYear)] 
        const last = terrestrialChangesByMoku[k][String(terrestrialFilter.endYear)]
        const abs_change = last - first
        terrestrialChangesByMoku[k].absolute_change = abs_change
        terrestrialChangesByMoku[k].relative_change = first != 0 ? (abs_change / first) * 100 : 0
        terrestrialChangesByMoku[k].firstYearValue = first;
        terrestrialChangesByMoku[k].lastYearValue = last;
    })

    // aggregate into GeoJSON
    function aggregateGeoJSON(originalGeoJSON: GeoJSON | null) {
        const aggregatedExtentsGeoJSON = {...originalGeoJSON,
            features: originalGeoJSON?.features.map(feat => {
                const key = `${feat.properties.moku_olelo}_${feat.properties.island_olelo}`
                const specific_moku = terrestrialChangesByMoku[key]
                return ({
                    ...feat,
                    properties: {
                        name: key,
                        relative_change: specific_moku.relative_change,
                        absolute_change: specific_moku.absolute_change,
                        year1Value: specific_moku.firstYearValue,
                        year2Value: specific_moku.lastYearValue,
                        year1: terrestrialFilter.startYear,
                        year2: terrestrialFilter.endYear,
                        ecosystem_type: terrestrialFilter.ecosystem,
                    }
                })
            })
        }
        return aggregatedExtentsGeoJSON
    }

    const activeGeoData = aggregateGeoJSON(terrestrialGeoJSON)

    const computedColorThresholds = (() => {
        let sorted: number[]

        sorted = Object.values(terrestrialChangesByMoku).map((e: any) => e.relative_change).sort((a, b) => a - b);
        // restrict to 2 decimal places in terms of %.
        const percent1 = Math.round(sorted[Math.floor(sorted.length * 0.1)] * 100) / 100
        const percent9 = Math.round(sorted[Math.floor(sorted.length * 0.9)] * 100) / 100
        if (percent1 < 0 && percent9 > 0) {
            if (Math.abs(percent1) > Math.abs(percent9)) {
            return [percent1, 0-percent1]
            } else {
            return [0-percent9, percent9]
            }
        }
        return [percent1, percent9]
    }) ();

    console.log(computedColorThresholds)

    // this one is duplicated - can refactor
    const handleAreaClick = (areaId: string) => {
        const next = selectedArea === areaId ? "" : areaId;
        setSelectedArea(next);
        if (next !== "") setActiveTab("viz");
    };

    const currentFilter = terrestrialFilter
    const currentFilterOptions = terrestrialFilterOptions

    console.log(terrestrialChangesByMoku)

    return (
        <div className="dashboard-main">
            {/* Map */}
            <div className="central-panel">
                <div className="summary-display">
                    <p>Relative change in <span className="summary-highlight">{currentFilter.ecosystem?.toLocaleLowerCase()}</span> ecosystems: {currentFilter.startYear}-{currentFilter.endYear}</p>
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
                        <ExtentsFilterMenu
                            key={dataset} 
                            filterOptions={currentFilterOptions}
                            currentFilter={currentFilter}
                            onChangeFilter={handleFilterChange}
                        />
                    )}

                    {/* ── VIZ TAB ── */}
                    {activeTab === "viz" && (
                        <CompactDataView 
                            selectedArea={selectedArea}
                            filteredRows={filteredRows}
                            dataset={dataset}
                            resetFiltersOnClose={resetFilter}
                        />
                    )}
                </div>
            </div>
        </div>
    );

}