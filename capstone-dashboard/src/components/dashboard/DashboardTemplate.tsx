"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import dynamic from "next/dynamic";
import L, { LatLngExpression } from "leaflet";
import GeoJSONLayer from "./GeoJSONLayer";
import Legend from "./Legend";
import "../dashboard/dashboard.css";
import "leaflet/dist/leaflet.css";

interface colorThresholds {
    colors: string[],
    thresholds: number[],
    thresholdDisplays: string[]
}

interface FilterDescription {
    btnVars: string[],
    dropdownVars: string[],
    singleRangeVars: string[],
    doubleRangeVars: string[],
    displayText: Record<string, string> // must be "variable name": "display"
}

const position: LatLngExpression = [20.5, -157.5];

interface DashboardProps<TRow, TFilter> {
    geoJSONPath: string,
    uniqFunctions: {
        parseGeoJSONFn: (rawGeoJSON: any[]) => TRow[];
        establishFilterFn: (rows: TRow[]) => {
            filterOptions: Record<string, any[]>,
            defaultFilter: TFilter,
            filterDescriptions: FilterDescription,
        }
        filterFn: (rows: TRow[], filter: TFilter) => Record<string, any>;
        colorCalculationFn: (agg: Record<string, any>, defaultColors?: [string, string], numWholeSegments?: number) => colorThresholds;
        newGeoJSONFn: (originalGeoJSON: any, agg: Record<string, any>, appliedFilter?: Record<string, any>) => any;
    },
    getToolTip: (feat: any, appliedFilters: TFilter, colorThresholds: colorThresholds) => React.ReactNode,
    getTitle: (appliedFilters: TFilter) => React.ReactNode,
}

export default function DashboardTemplate<TRow, TFilter> ({
    geoJSONPath,
    uniqFunctions,
    getToolTip,
    getTitle,
} : DashboardProps<TRow, TFilter>) {
    const [geoData, setGeoData] = useState(null);
    const [selectedArea, setSelectedArea] = useState("");
    const [activeTab, setActiveTab] = useState<"filter" | "viz">("filter");

    // filters
    const [currentFilter, setCurrentFilter] = useState<TFilter | {}>({})

    // for the legend
    const [colorRange, setColorRange] = useState<[string, string]>()
    const [numWholeSegments, setNumWholeSegments] = useState<number>()

    // Load data
    useEffect(() => {
        async function loadData() {
            const geo = await fetch(geoJSONPath)
            const json = await geo.json()
            setGeoData(json)
        }
        loadData();
    }, []);

    // convert geoJSON into rows
    const rowData: any = useMemo(() => geoData ? uniqFunctions.parseGeoJSONFn(geoData) : null, [geoData])

    // extract filter ranges from rows
    const filterInfo = useMemo(() => rowData ? uniqFunctions.establishFilterFn(rowData) : null, [rowData])

    if (!rowData || rowData.length == 0) return <div>Loading...</div>;

    const filterRange = filterInfo && filterInfo.filterOptions
    const defaultFilter = filterInfo ? filterInfo.defaultFilter : {}

    // find the default filter
    if (Object.keys(currentFilter as Object).length <= 0) {
        setCurrentFilter(defaultFilter)
    }

    if (Object.keys(currentFilter as Object).length <= 0) return <div>Loading...</div>;

    // ======== if filter isn't loaded, it short circuits here. ========

    // actually filter the rows here. This turns it into the form of {location1: value1, location2: value2, location3: value3}
    const aggByLocation = uniqFunctions.filterFn(rowData, currentFilter as TFilter);

    // compute color breakdown. Returns an object for showing the thresholds and colors.
    // e.g. {thresholds: [0, 100, 200], colors: ["red", "green", "blue", "yellow"]}
    const colorBreakdowns = uniqFunctions.colorCalculationFn(aggByLocation, colorRange, numWholeSegments);

    // reaggregate to GeoJSON
    const newGeoJSON = uniqFunctions.newGeoJSONFn(geoData, aggByLocation)

    /* ============ STATE CHANGING FUNCTIONS BELOW. CALLED BY CHILD COMPONENTS ============ */

    // for changing the filter
    const handleFilterChange = (はい: Record<string, any>) => {
        // well this is pretty cool I never knew I can put japanese here :)
        setCurrentFilter({...はい})
    }

    // common function
    const handleAreaClick = (areaId: string) => {
        const next = selectedArea === areaId ? "" : areaId;
        setSelectedArea(next);
        if (next !== "") setActiveTab("viz");
    };

    // for the legend
    // only updates when user presses "submit."
    const handleColorChange = (clr1: string, clr2: string) => {
        const newArray: [string, string] = [clr1, clr2]
        setColorRange(newArray)
    }

    // updates whenever user drags the slider on the legend.
    const handleSegmentChange = (seg: number) => {
        setNumWholeSegments(seg)
    }

    return (
        <div className="dashboard-main">
            <div className="central-panel">
                <div className="summary-display">{getTitle(currentFilter as TFilter)}</div>

                {geoData && 
                <div style={{ width: "100%", height: "100%" }}>
                    <Legend colorBreakdowns={colorBreakdowns} unit="Total Exchange Value (USD)" onChangeColor={handleColorChange} onChangeSegment={handleSegmentChange} />
                      
                    <MapContainer center={position} zoom={7} zoomControl={false} style={{ width: "100%", height: "100%" }}>
                        <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                        <ZoomControl position="topright" />
                        <GeoJSONLayer
                            geoData={newGeoJSON}
                            filter={currentFilter}
                            selectedArea={selectedArea}
                            colorBreakdowns={colorBreakdowns}
                            onCountyClickFn={handleAreaClick}
                            toolTipFn={getToolTip}
                        />
                    </MapContainer>
                </div>}
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
                    {activeTab === "filter" && (<p>My bad chat this will work</p>)}

                    {/* ── VIZ TAB ── */}
                    {activeTab === "viz" && (<p>My bad chat this will work</p>

                    )}
                </div>
            </div>
        </div>
    );

    // function that takes from the child component
    /* const handleFilterChange = (yearStart: number, yearEnd: number, county: string, species: string, ecosystem: string) => {
        const temp_new_filter: FisheryFilterSettings = {
            startYear: yearStart,
            endYear: yearEnd,
            county: county,
            species: species,
            ecosystem: ecosystem
        }

        if (dataset === "noncomm") {
            setNonCommFilter(temp_new_filter)
        } else {
            setCommFilter(temp_new_filter)
        }
    }

    // also gets called from the child component (the sidebar.)
    const resetFilter = () => {
        setSelectedArea("");
        if (dataset == "comm") {
            setCommFilter(getDefaultFilterValues(commFilterOptions))
        } else {
            setNonCommFilter(getDefaultFilterValues(nonCommFilterOptions))
        }
    } */
}
