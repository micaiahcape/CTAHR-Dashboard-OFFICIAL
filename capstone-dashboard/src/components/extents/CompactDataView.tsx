import { useState } from "react";
import dynamic from "next/dynamic";
import { ExtentsRow } from "./ExtentsDashboard";
// @ts-ignore CSS side-effect imports are resolved by the bundler.
import "../dashboard/dashboard.css";

interface CompactProps {
	selectedArea: string,
	filteredRows: Array<DataRow>,
	dataset: string,
	resetFiltersOnClose: () => void;
}

export default function CompactDataView({ 
	selectedArea, 
	filteredRows, 
	resetFiltersOnClose 
} : CompactProps) {

	const [showRawData, setShowRawData] = useState(false);

	const extentsPanelRows = selectedArea ? filteredRows.filter((r) => r.moku_key === selectedArea) : [];

  	// Year totals identify the latest snapshot and comparison range.
	const extentsByYear: Record<number, number> = {};
	extentsPanelRows.forEach((row) => {
		extentsByYear[row.year] = (extentsByYear[row.year] || 0) + row.area_km2;
	});

	const extentsYearEntries = Object.entries(extentsByYear)
		.map(([k, v]) => [Number(k), v] as [number, number])
		.sort(([a], [b]) => a - b);

	// Latest year snapshot supplies the subtitle ("2019 area X km²").
	const extentsSnapshotYear = extentsYearEntries.length > 0
		? extentsYearEntries[extentsYearEntries.length - 1][0]
		: null;
	const extentsTotalArea = extentsSnapshotYear !== null
		? extentsPanelRows
			.filter((r) => r.year === extentsSnapshotYear)
			.reduce((sum, r) => sum + r.area_km2, 0)
		: 0;

	// Per ecosystem change between first and last year in viz range
	const extentsEcoByYear: Record<string, Record<number, number>> = {};
	extentsPanelRows.forEach((row) => {
		if (!extentsEcoByYear[row.ecosystem_type]) extentsEcoByYear[row.ecosystem_type] = {};
		extentsEcoByYear[row.ecosystem_type][row.year] =
		(extentsEcoByYear[row.ecosystem_type][row.year] || 0) + row.area_km2;
	});

	// Composition insight. Moku boundaries are fixed, so the meaningful change is
	// how individual ecosystems gained or lost area within the moku, not the total.
	const extentsInsight = (() => {
		if (extentsYearEntries.length < 2) return null;
		const firstYr = extentsYearEntries[0][0];
		const lastYr = extentsYearEntries[extentsYearEntries.length - 1][0];

		type EcoChange = {
			eco: string;
			firstArea: number;
			lastArea: number;
			delta: number;
			pct: number | null;
		};

		const changes: EcoChange[] = Object.entries(extentsEcoByYear).map(([eco, byYr]) => {
			const firstArea = byYr[firstYr] || 0;
			const lastArea = byYr[lastYr] || 0;
			const delta = lastArea - firstArea;
			const pct = firstArea > 0 ? (delta / firstArea) * 100 : null;
			return { eco, firstArea, lastArea, delta, pct };
		});

		if (changes.length === 0) return null;

		const byDelta = changes.slice().sort((a, b) => b.delta - a.delta);
		const topGainer = byDelta[0].delta > 0 ? byDelta[0] : null;
		const topLoser = byDelta[byDelta.length - 1].delta < 0 ? byDelta[byDelta.length - 1] : null;

		// Headline = ecosystem with biggest absolute change (drives the trend chip)
		const headline = changes.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
		const hasChange = Math.abs(headline.delta) > 0.005;

		return { firstYr, lastYr, topGainer, topLoser, headline, hasChange, changes };
	})();

	// Per ecosystem deltas, sorted by absolute change for the bar chart.
	const extentsChangeEntries = extentsInsight
		? extentsInsight.changes.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
		: [];
	const maxExtentsChangeAbs = extentsChangeEntries.length > 0
		? Math.max(...extentsChangeEntries.map((c) => Math.abs(c.delta)), 1)
		: 1;

	return (<>
		<div className="viz-header">
			<div>
				<div className="data-panel-title">{selectedArea}</div>
				<div className="data-panel-subtitle">
					{extentsPanelRows.length} record{extentsPanelRows.length !== 1 ? "s" : ""}
					{extentsSnapshotYear !== null && (
					<>&nbsp;&mdash;&nbsp;{extentsSnapshotYear} area {extentsTotalArea.toFixed(2)} km²</>
					)}
				</div>
			</div>
			<button className="data-panel-close" onClick={() => {resetFiltersOnClose()}}>✕</button>
		</div>

		{/* Hero metric card showing the biggest ecosystem change */}
		{extentsInsight && extentsInsight.hasChange && (() => {
			const isUp = extentsInsight.headline.delta > 0;
			const accent = isUp ? "#4caf82" : "#d94801";
			return (
			<div className="metric-hero-card" style={{ borderLeftColor: accent }}>
				<div className="metric-hero-value" style={{ color: accent }}>
				{isUp ? "+" : ""}{extentsInsight.headline.delta.toFixed(2)} km²
				</div>
				<div className="metric-hero-label">
				BIGGEST ECOSYSTEM CHANGE ({extentsInsight.firstYr}&ndash;{extentsInsight.lastYr})
				</div>
				<div className="metric-trend">
				<span className="metric-trend-arrow" style={{ color: accent }}>{isUp ? "▲" : "▼"}</span>
				<span className="metric-trend-pct" style={{ color: accent }}>
					{extentsInsight.headline.pct === null
					? "new"
					: `${Math.abs(extentsInsight.headline.pct).toFixed(1)}%`}
				</span>
				<span className={`metric-trend-label ${isUp ? "trend-up" : "trend-down"}`}>
					{extentsInsight.headline.eco}
				</span>
				</div>
				<p className="metric-summary">
				<strong>{extentsInsight.headline.eco}</strong> had the largest area change across all ecosystem types from {extentsInsight.firstYr} to {extentsInsight.lastYr}:{" "}
				<span style={{ color: accent, fontWeight: 600 }}>
					{isUp ? "+" : ""}{extentsInsight.headline.delta.toFixed(2)} km²{" "}
					({extentsInsight.headline.pct === null
					? "new"
					: `${isUp ? "+" : ""}${extentsInsight.headline.pct.toFixed(1)}%`})
				</span>.
				</p>
			</div>
			);
		})()}

		{extentsInsight && !extentsInsight.hasChange && (
			<div className="metric-hero-card">
			<div className="metric-hero-label">
				NO CHANGE ({extentsInsight.firstYr}&ndash;{extentsInsight.lastYr})
			</div>
			<p className="metric-summary">
				From {extentsInsight.firstYr} to {extentsInsight.lastYr}, ecosystems stayed about the same.
			</p>
			</div>
		)}

		{/* Per ecosystem area change bars */}
		{extentsInsight && extentsChangeEntries.length > 0 && (
			<div className="chart-section">
			<div className="chart-section-label">
				Area Change by Ecosystem Type ({extentsInsight.firstYr}&ndash;{extentsInsight.lastYr})
			</div>
			{extentsChangeEntries.map((c) => {
				const isUp = c.delta > 0;
				const color = isUp ? "#4caf82" : "#d94801";
				const widthPct = (Math.abs(c.delta) / maxExtentsChangeAbs) * 100;
				return (
				<div key={c.eco} className="bar-row">
					<div className="bar-name" title={c.eco}>{c.eco}</div>
					<div className="bar-track">
					<div className="bar-fill" style={{ width: `${widthPct}%`, background: color }} />
					</div>
					<div className="bar-value" style={{ color }}>
					{isUp ? "+" : ""}{c.delta.toFixed(2)} km²
					</div>
				</div>
				);
			})}
			</div>
		)}

		{/* Raw data table */}
		<div className="raw-data-section">
			<button
			className="raw-data-toggle"
			onClick={() => setShowRawData((v) => !v)}
			>
			<span className="raw-data-toggle-arrow">{showRawData ? "▲" : "▼"}</span>
			Show raw data
			</button>
			{showRawData && (
			<table className="data-table">
				<thead>
				<tr>
					<th>Year</th>
					<th>Ecosystem</th>
					<th>Area (km²)</th>
				</tr>
				</thead>
				<tbody>
				{extentsPanelRows
					.slice()
					.sort((a, b) => a.year - b.year)
					.map((row, i) => (
					<tr key={i}>
						<td>{row.year}</td>
						<td>{row.ecosystem_type}</td>
						<td>{row.area_km2.toFixed(2)}</td>
					</tr>
					))}
				</tbody>
				<tfoot>
				<tr>
					<td colSpan={2}>Total</td>
					<td>{extentsPanelRows.reduce((s, r) => s + r.area_km2, 0).toFixed(2)}</td>
				</tr>
				</tfoot>
			</table>
			)}
		</div>
	</>)
}