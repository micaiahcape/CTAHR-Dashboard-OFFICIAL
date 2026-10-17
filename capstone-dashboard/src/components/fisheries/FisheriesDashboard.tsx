"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import "../dashboard/dashboard.css";
import FilterSidebar from "../dashboard/FilterSidebar";
import FisheriesFilterMenu from "./FisheriesFilterMenu";
import { Allison } from "next/font/google";

const Map = dynamic(() => import("../map/Map"), { ssr: false });

interface DataRow {
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

// format currency
const formatCurrency = (value: number) =>
	new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
	}).format(value);

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
		/* const species = toArr(p.species_group).map(String);
		const ecosystems = toArr(p.ecosystem_type).map(String);
		const values = toArr(p.exchange_value).map(Number); */
	
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

function LineChart({ entries, formatValue, color = "#d94801" }: { entries: [number, number][]; formatValue?: (v: number) => string; color?: string }) {
  	const [hovered, setHovered] = useState<number | null>(null);

	if (entries.length < 2) return null;

	const W = 300, H = 90;
	const padL = 4, padR = 4, padT = 8, padB = 22;
	const chartW = W - padL - padR;
	const chartH = H - padT - padB;

	const maxY = Math.max(...entries.map(([, v]) => v), 1);
	const minX = entries[0][0];
	const maxX = entries[entries.length - 1][0];
	const spanX = maxX - minX || 1;

	const toX = (year: number) => padL + ((year - minX) / spanX) * chartW;
	const toY = (val: number) => padT + chartH - (val / maxY) * chartH;

	const pts = entries.map(([yr, v]) => [toX(yr), toY(v)] as [number, number]);
	const bottomY = padT + chartH;

	const areaPath = [
		`M ${pts[0][0]} ${bottomY}`,
		...pts.map(([x, y]) => `L ${x} ${y}`),
		`L ${pts[pts.length - 1][0]} ${bottomY}`,
		"Z",
  	].join(" ");

  	const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

	const labelIndices = new Set<number>([0, entries.length - 1]);
	if (entries.length > 3) {
		const step = Math.floor(entries.length / 3);
		for (let i = step; i < entries.length - step; i += step) labelIndices.add(i);
	}

	const formatK = (v: number) =>
		formatValue
		? formatValue(v)
		: v >= 1_000_000
		? `$${(v / 1_000_000).toFixed(1)}M`
		: v >= 1_000
		? `$${(v / 1_000).toFixed(0)}K`
		: `$${v.toFixed(0)}`;

	const tooltip = hovered !== null ? (() => {
		const [cx, cy] = pts[hovered];
		const [year, val] = entries[hovered];
		const label = formatK(val);
		const tipW = 68, tipH = 26, tipR = 3;
		const flipLeft = cx > W / 2;
		const tx = flipLeft ? cx - tipW - 6 : cx + 6;
		const ty = Math.max(padT, cy - tipH / 2);
		return { cx, cy, year, label, tx, ty, tipW, tipH, tipR };
	})() : null;

	return (
		<svg
		viewBox={`0 0 ${W} ${H}`}
		style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
		>
		<defs>
			<linearGradient id={`lineAreaGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stopColor={color} stopOpacity="0.35" />
			<stop offset="100%" stopColor={color} stopOpacity="0.04" />
			</linearGradient>
		</defs>
		<path d={areaPath} fill={`url(#lineAreaGrad-${color.replace("#", "")})`} />
		<path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />

		{pts.map(([x, y], i) => (
			<circle
			key={`hit-${i}`}
			cx={x} cy={y} r="8"
			fill="transparent"
			style={{ cursor: "crosshair" }}
			onMouseEnter={() => setHovered(i)}
			onMouseLeave={() => setHovered(null)}
			/>
		))}

		{pts.map(([x, y], i) => (
			<circle
			key={`dot-${i}`}
			cx={x} cy={y}
			r={hovered === i ? 4 : 2.5}
			fill={color}
			style={{ pointerEvents: "none", transition: "r 0.1s" }}
			/>
		))}

		{tooltip && (
			<line
			x1={tooltip.cx} y1={padT}
			x2={tooltip.cx} y2={bottomY}
			stroke={color} strokeWidth="0.8" strokeDasharray="3 2"
			style={{ pointerEvents: "none" }}
			/>
		)}

		{tooltip && (
			<g style={{ pointerEvents: "none" }}>
			<rect
				x={tooltip.tx} y={tooltip.ty}
				width={tooltip.tipW} height={tooltip.tipH}
				rx={tooltip.tipR} ry={tooltip.tipR}
				fill="#1a1a1a" stroke={color} strokeWidth="0.8"
			/>
			<text x={tooltip.tx + tooltip.tipW / 2} y={tooltip.ty + 10} textAnchor="middle" fontSize="7.5" fill="#888">
				{tooltip.year}
			</text>
			<text x={tooltip.tx + tooltip.tipW / 2} y={tooltip.ty + 20} textAnchor="middle" fontSize="8.5" fontWeight="bold" fill={color}>
				{tooltip.label}
			</text>
			</g>
		)}

		{[...labelIndices].map((i) => (
			<text
			key={entries[i][0]}
			x={toX(entries[i][0])}
			y={H - 5}
			textAnchor="middle"
			fontSize="8"
			fill="#666"
			>
			{entries[i][0]}
			</text>
		))}
		</svg>
	);
}

export default function FisheriesDashboard ({ dataset } : DashboardProps) {
	const [geoData, setGeoData] = useState<GeoJSON | null>(null);

	// holds the raw GeoJSON files.
	const [commGeoJSON, setCommGeoJSON] = useState<GeoJSON | null>(null);
	const [nonCommGeoJSON, setNonCommGeoJSON] = useState<GeoJSON | null>(null);
	const [showRawData, setShowRawData] = useState(false);
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
		console.log(areaId)
		const next = selectedArea === areaId ? "" : areaId;
		setSelectedArea(next);
		setShowRawData(false);
		if (next !== "") setActiveTab("viz");
	};

	// ----------------------------------
	// Viz panel data
	// ----------------------------------
	const panelRows = selectedArea
		? filteredRows.filter((r) => r.area_name === selectedArea)
		: [];

	const byYear: Record<number, number> = {};
	const bySpecies: Record<string, number> = {};
	const byEcosystem: Record<string, number> = {};

	console.log(panelRows)

	panelRows.forEach((row) => {
		byYear[row.year] = (byYear[row.year] || 0) + row.exchange_value;
		bySpecies[row.species_group] = (bySpecies[row.species_group] || 0) + row.exchange_value;
		byEcosystem[row.ecosystem_type] = (byEcosystem[row.ecosystem_type] || 0) + row.exchange_value;
	});

	const yearEntries = Object.entries(byYear)
		.map(([k, v]) => [Number(k), v] as [number, number])
		.sort(([a], [b]) => a - b);

	console.log(yearEntries)

	const speciesEntries = Object.entries(bySpecies).sort(([, a], [, b]) => b - a);
	const ecosystemEntries = Object.entries(byEcosystem).sort(([, a], [, b]) => b - a);

	const maxSpecies = Math.max(...speciesEntries.map(([, v]) => v), 1);
	const maxEco = Math.max(...ecosystemEntries.map(([, v]) => v), 1);

	const tableTotal = panelRows.reduce((sum, r) => sum + r.exchange_value, 0);
	const tableRows = panelRows
		.slice()
		.sort((a, b) => a.year !== b.year ? a.year - b.year : a.species_group.localeCompare(b.species_group));

	let trendPct: number | null = null;
	let firstYear: number | null = null;
	let lastYear: number | null = null;
	if (yearEntries.length >= 2) {
		firstYear = yearEntries[0][0];
		lastYear = yearEntries[yearEntries.length - 1][0];
		const firstVal = yearEntries[0][1];
		const lastVal = yearEntries[yearEntries.length - 1][1];
		if (firstVal > 0) trendPct = ((lastVal - firstVal) / firstVal) * 100;
	}

	const topSpecies = speciesEntries[0]?.[0] ?? null;
	const topEcosystem = ecosystemEntries[0]?.[0] ?? null;

	const trendIsUp = trendPct !== null && trendPct > 0;
	const trendLabel = trendIsUp ? "Improving" : "Declining";

	const summaryText = (() => {
		const parts: string[] = [];
		if (trendPct !== null && firstYear && lastYear) {
		parts.push(
			`Exchange value ${trendIsUp ? "improved" : "declined"} ${Math.abs(trendPct).toFixed(1)}% from ${firstYear} to ${lastYear}.`
		);
		}
		if (topSpecies) parts.push(`${topSpecies} contributed the most across species.`);
		if (topEcosystem) parts.push(`The ${topEcosystem} ecosystem was the top contributor.`);
		return parts.join(" ");
	})();

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
					layerType={"fisheries"}
					geoData={activeGeoData}
					selectedCounty={selectedArea}
					selectedYearStart={currentFilter.startYear}
					selectedYearEnd={currentFilter.endYear}
					selectedSpecies={currentFilter.species}
					selectedEcosystem={currentFilter.ecosystem}
					onCountyClick={handleAreaClick}
					outliers={computedColorThresholds} 
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

				{/* ── FILTER TAB ── */}
				{activeTab === "filter" && (
					<div className="rp-content">
						<FisheriesFilterMenu 
							key={dataset}
							filterOptions={currentFilterOptions}
							currentFilter={currentFilter}
							onChangeFilter={handleFilterChange}
							dataset={dataset}
						/>
					</div>
				)}

			{/* ── VIZ TAB ── */}
			{activeTab === "viz" && (
			<>
				<div className="viz-header">
					<div>
						<div className="data-panel-title">
							{dataset === "comm" ? selectedArea : `${selectedArea} County`}
						</div>
						<div className="data-panel-subtitle">
							{tableRows.length} record{tableRows.length !== 1 ? "s" : ""}&nbsp;&mdash;&nbsp;Total {formatCurrency(tableTotal)}
						</div>
					</div>
					<button className="data-panel-close" onClick={() => {
						setSelectedArea("");
						if (dataset == "comm") {
							setCommFilter(getDefaultFilterValues(commFilterOptions))
						} else {
							setNonCommFilter(getDefaultFilterValues(nonCommFilterOptions))
						}
					}}>✕</button>
				</div>

				{(() => {
					const fishAccent = trendPct !== null && trendIsUp ? "#4caf82" : "#d94801";
					return (
					<>
						<div className="metric-hero-card" style={trendPct !== null ? { borderLeftColor: fishAccent } : undefined}>

							<div className="metric-hero-value" style={trendPct !== null ? { color: fishAccent } : undefined}>{formatCurrency(tableTotal)}</div>
							<div className="metric-hero-label">TOTAL EXCHANGE VALUE</div>

							{trendPct !== null && (
								<div className="metric-trend">
								<span className="metric-trend-arrow" style={{ color: fishAccent }}>
									{trendIsUp ? "▲" : "▼"}
								</span>
								<span className="metric-trend-pct" style={{ color: fishAccent }}>
									{Math.abs(trendPct).toFixed(1)}%
								</span>
								<span className={`metric-trend-label ${trendIsUp ? "trend-up" : "trend-down"}`}>
									{trendLabel}
								</span>
								</div>
							)}

							{summaryText && <p className="metric-summary">{summaryText}</p>}
						</div>

						{yearEntries.length > 0 && (
						<div className="chart-section">
							<div className="chart-section-label">Exchange Value Trend by Year</div>
							<LineChart entries={yearEntries} color={fishAccent} />
						</div>)}
					</>);
				})()}

				{speciesEntries.length > 0 && (
					<div className="chart-section">
					<div className="chart-section-label">By Species Group</div>
					{speciesEntries.map(([name, value]) => (
						<div key={name} className="bar-row">
						<div className="bar-name" title={name}>{name}</div>
						<div className="bar-track">
							<div className="bar-fill" style={{ width: `${(value / maxSpecies) * 100}%` }} />
						</div>
						<div className="bar-value">{formatCurrency(value)}</div>
						</div>
					))}
					</div>
				)}

				{ecosystemEntries.length > 0 && (
				<div className="chart-section">
					<div className="chart-section-label">By Ecosystem Type</div>
					{ecosystemEntries.map(([name, value]) => (
						<div key={name} className="bar-row">
							<div className="bar-name" title={name}>{name}</div>
							<div className="bar-track">
								<div className="bar-fill" style={{ width: `${(value / maxEco) * 100}%` }} />
							</div>
							<div className="bar-value">{formatCurrency(value)}</div>
						</div>
					))}
				</div>)}

				<div className="raw-data-section">
					<button className="raw-data-toggle" onClick={() => setShowRawData((v) => !v)}>
						<span className="raw-data-toggle-arrow">{showRawData ? "▲" : "▼"}</span>Show raw data
					</button>

					{showRawData && (
					<table className="data-table">
						<thead>
						<tr>
							<th>Year</th>
							<th>Species</th>
							<th>Ecosystem</th>
							<th>Value</th>
						</tr>
						</thead>
						<tbody>
						{tableRows.map((row, i) => (
							<tr key={i}>
							<td>{row.year}</td>
							<td>{row.species_group}</td>
							<td>{row.ecosystem_type}</td>
							<td>{formatCurrency(row.exchange_value)}</td>
							</tr>
						))}
						</tbody>
						<tfoot>
						<tr>
							<td colSpan={3}>Total</td>
							<td>{formatCurrency(tableTotal)}</td>
						</tr>
						</tfoot>
					</table>)}
				</div>
			</>)}
		</div>
	</div>);
}
