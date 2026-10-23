"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import "../dashboard/dashboard.css";
import FisheriesFilterMenu from "./FisheriesFilterMenu";

const Map = dynamic(() => import("../map/Map"), { ssr: false });
const CompactDataView = dynamic(() => import("./CompactDataView"), { ssr: false })

export interface DataRow {
  	year: number;
	area_name: string;
  	species_group: string;
  	ecosystem_type: string;
  	exchange_value: number;
	county: string;
}

interface GeoFeature {
  	type: string;
  	properties: Record<string, unknown>;
	geometry: unknown;
}

interface GeoJSON {
  	type: string;
  	features: GeoFeature[];
}

interface DashboardProps {
	dataset: string,
}

export interface FisheryFilterSettings {
	startYear: number,
	endYear: number,
	county: string,
	species: string,
	ecosystem: string,
}

export interface FisheryFilterOptions {
	species_list: string[],
	ecosystem_list: string[],
	counties_list: string[],
	years: number[],
}

function normalizeCounty(raw: any): string {
  	const map: Record<string, string> = {
		"Hawaiʻi": "Hawaii",
		"Kauaʻi": "Kauai",
		"Maui": "Maui",
		"Honolulu": "Honolulu",
		"Lanai": "Maui",
		"Molokai": "Maui",
  	};
  	return map[raw] ?? raw;
}

/*******************
 * Returns rows like this:
 * 
 * [{year: <year>, area_name: <area_id>, species_group: <species_group>, ecosystem_type: <ecosystem_type>, exchange_value: <exchange_value>}, 
 * {year: <year>, area_name: <area_id>, species_group: <species_group>, ecosystem_type: <ecosystem_type>, exchange_value: <exchange_value>}, {...}, ...]
 * 
 ************************/

function parseFisheriesGeoJSON(geojson: GeoJSON, datatype: string): DataRow[] {
	const rows: DataRow[] = [];
	for (const feat of geojson.features) {
		const p: any = feat.properties;
		const name: string = datatype == "comm" ? String(p.area_id) : String(p.island_olelo)
		const county = normalizeCounty(p.county_olelo)

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
				county: county,
				species_group: (typeof p.species_group === "string" ? p.species_group : p.species_group[i]),
				ecosystem_type: (typeof p.ecosystem_type === "string" ? p.ecosystem_type : p.ecosystem_type[i]),
				exchange_value: val,
			});
		}
	}

	return rows;
}

export default function FisheriesDashboard ({ dataset } : DashboardProps) {
	const [geoData, setGeoData] = useState<GeoJSON | null>(null);

	// holds the raw GeoJSON files.
	const [commGeoJSON, setCommGeoJSON] = useState<GeoJSON | null>(null);
	const [nonCommGeoJSON, setNonCommGeoJSON] = useState<GeoJSON | null>(null);
	const [selectedArea, setSelectedArea] = useState("");
	const [activeTab, setActiveTab] = useState<"filter" | "viz">("filter");

	// Fisheries filters
	const nullFilter: FisheryFilterSettings = {startYear: -1, endYear: -1, county: "", species: "", ecosystem: ""}
	const [commFilter, setCommFilter] = useState<FisheryFilterSettings>(nullFilter)
	const [nonCommFilter, setNonCommFilter] = useState<FisheryFilterSettings>(nullFilter)

	// for downloading.
	const [downloadCounty, setDownloadCounty] = useState("");
	const [downloadMode, setDownloadMode] = useState<"ALL_SEPARATE" | "ONE_COUNTY">("ONE_COUNTY");
	const [downloadExtentsMokus, setDownloadExtentsMokus] = useState<string[]>([]);
	const [downloadExtentsEcosystems, setDownloadExtentsEcosystems] = useState<string[]>([]);

	// Load fisheries data
	useEffect(() => {
		async function loadData() {
			const [commGeo, nonCommGeo] = await Promise.all([
				fetch("/fisheriesdata/USED_IN_PROJECT/10_14_2026_comm_EV_byCatchmentArea.geojson"),
				fetch("/fisheriesdata/USED_IN_PROJECT/10_14_2026_noncomm_EV_byIsland.geojson"),
			]);
			const [c, nc] = await Promise.all([commGeo.json(), nonCommGeo.json()]);		
			setCommGeoJSON(c)
			setNonCommGeoJSON(nc)
		}

		console.log("LOADING DATASET")
		loadData();
		console.log("LOADED DATASET")
	}, []);

	const commRowData = useMemo(() => {
		return commGeoJSON ? parseFisheriesGeoJSON(commGeoJSON, "comm") : []
	}, [commGeoJSON])

	const nonCommRowData = useMemo(() => {
		return nonCommGeoJSON ? parseFisheriesGeoJSON(nonCommGeoJSON, "noncomm") : []
	}, [nonCommGeoJSON])

	// ======== establish the filter ranges and the filters' default values. ========

	function establishFilterRange(data: DataRow[]) {
		if (data.length <= 0) return {years: [0, 1]}
		
		const species_list = [...new Set(data.map((r) => r.species_group))].sort()
		const ecosystem_list = [...new Set(data.map((r) => r.ecosystem_type))].sort()

		if (species_list.length > 1) {
			species_list.unshift("All Species");
		}

		if (ecosystem_list.length > 1) {
			ecosystem_list.unshift("All Ecosystems");
		}

		return ({
			species_list: species_list,
			ecosystem_list: ecosystem_list,
			counties_list: [...new Set(data.map((d) => d.county))].sort(),
			years: [...new Set(data.map((d) => d.year))].sort((a, b) => a - b),
		})
	}

	const commFilterOptions = useMemo(() => {return establishFilterRange(commRowData)}, [commRowData])
	const nonCommFilterOptions = useMemo(() => {return establishFilterRange(nonCommRowData)}, [nonCommRowData])

	if (commRowData.length == 0 || nonCommRowData.length == 0) return <div>Loading fisheries...</div>;

	// ======== if data isn't loaded, it short circuits here. ========

	const pickDefault = (values: string[], aggregateLabel: string) =>
	values.includes(aggregateLabel) ? aggregateLabel : values[0] ?? "";

	// assign the default filter values based on the computed filter options.
	function getDefaultFilterValues(filterList: any) {
		return ({
			startYear: filterList.years[0],
			endYear: filterList.years[filterList.years.length - 1],
			county: "",
			species: (pickDefault(filterList.species_list, "All Species")),
			ecosystem: (pickDefault(filterList.ecosystem_list, "All Ecosystems"))
		})
	}

	// While the dataset is being processed, "startYear" has a placeholder value of -1. Initialize the filters to their default values once the dataset is processed.
	if (commFilter.startYear < 0) {
		setCommFilter(getDefaultFilterValues(commFilterOptions))
	}

	// same thing here
	if (nonCommFilter.startYear < 0) {
		setNonCommFilter(getDefaultFilterValues(nonCommFilterOptions))
	}

	// ======== actual filtering logic below. ========

	// function that takes from the child component
	const handleFilterChange = (yearStart: number, yearEnd: number, county: string, species: string, ecosystem: string) => {
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
	}

	// filters all rows according to the filter.
	const filteredRows = (() => {
		let rows: DataRow[]
		let filter: FisheryFilterSettings = nullFilter;

		if (dataset === "comm") {
			rows = commRowData
			filter = commFilter
		} else {
			rows = nonCommRowData
			filter = nonCommFilter
		}

		return rows.filter((row) => {
			return (
				(filter.startYear === null || row.year >= filter.startYear) &&
				(filter.endYear === null || row.year <= filter.endYear) &&
				(filter.county === "" || row.county === filter.county) &&
				// when it's "All Species" or "All Ecosystems", the code "short circuits" and returns all species rows and/or ecosystem rows.
				(filter.species === "All Species" || row.species_group === filter.species) &&
				(filter.ecosystem === "All Ecosystems" || row.ecosystem_type === filter.ecosystem)
			)
		})
	}) ();

	// ======== Transform the filtered data, merge it back to GeoJSON and compute the color thresholds. ========

	// sum up the exchange value by location.
	const filteredTotalsById: Record<string, number> = {};
	filteredRows.forEach((row) => {
		filteredTotalsById[row.area_name] = (filteredTotalsById[row.area_name] || 0) + row.exchange_value;
	});

	// compute color thresholds (10th and 90th percentile)
	const computedColorThresholds = (() => {
		let sorted: number[]
		sorted = Object.values(filteredTotalsById).sort((a, b) => a - b);
		const percent1 = Math.round(sorted[Math.floor(sorted.length * 0.1)])
		const percent9 = Math.round(sorted[Math.floor(sorted.length * 0.9)])
		return [percent1, percent9]
	}) ();

	// aggregate back to GeoJSON
	function aggregateGeoJSON (originalGeoJSON: GeoJSON | null) {
		console.log("The original GeoJSON is: ")
		console.log(originalGeoJSON)
		return ({
			...originalGeoJSON,
			features: originalGeoJSON?.features.map((feature: GeoFeature) => {
				const key: any = (dataset == "comm" ? feature.properties.area_id : feature.properties.island_olelo)
				return {
					...feature,
					properties: {
						name: key,
						total_exchange_value: filteredTotalsById[key] || 0,
					},
				};
			})
			.filter((feature: GeoFeature) =>
				(feature.properties.total_exchange_value as number) > 0
			),
		});
	}

	// re-aggregated GeoJSON. This will get passed down directly to the map layer.
	const activeGeoData = (dataset == "comm" ? aggregateGeoJSON(commGeoJSON) : aggregateGeoJSON(nonCommGeoJSON))

	console.log("The active GeoData is: ")
	console.log(activeGeoData)

	// determine which filter to use.
	const currentFilter: FisheryFilterSettings = (dataset == "comm" ? commFilter : nonCommFilter)
	const currentFilterOptions: FisheryFilterOptions = (dataset == "comm" ? commFilterOptions : nonCommFilterOptions)
	
	const handleAreaClick = (areaId: string) => {
		const next = selectedArea === areaId ? "" : areaId;
		setSelectedArea(next);
		if (next !== "") setActiveTab("viz");
	};

	return (
		<div className="dashboard-main">
			{/* Map */}
			<div className="central-panel">
				<div className="summary-display">
					<p>{(dataset == "comm") ? "Commercial" : "Non-commercial"} fisheries data, with <span className="summary-highlight">{(!currentFilter.species || currentFilter.species === "All Species") ? "ALL" : currentFilter.species.toLocaleLowerCase()}</span> species and <span className="summary-highlight">{(!currentFilter.ecosystem || currentFilter.ecosystem === "All Ecosystems") ? "ALL" : currentFilter.ecosystem.toLocaleLowerCase()}</span> ecosystems: {currentFilter.startYear}-{currentFilter.endYear}</p>
				</div>

				{activeGeoData && 
				<Map
					mapType={dataset}
					layerType="fisheries"
					geoData={activeGeoData}
					appliedFilters={currentFilter}
					outliers={computedColorThresholds} 
					onCountyClick={handleAreaClick}
					selectedArea={selectedArea}
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
						<FisheriesFilterMenu
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
