import { useState } from "react";
import dynamic from "next/dynamic";
import { DataRow } from "../fisheries/FisheriesDashboard";
const LineChart = dynamic(() => import("./LineChart"), { ssr: false });

interface CompactProps {
    selectedArea: string,
    filteredRows: Array<DataRow>,
    dataset: string,
    resetFiltersOnClose: () => void;
}

// format currency
const formatCurrency = (value: number) =>
	new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
	}).format(value);

export default function CompactDataView ({
    selectedArea,
    filteredRows,
    dataset,
    resetFiltersOnClose,
}: CompactProps) {

    const [showRawData, setShowRawData] = useState(false);

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

    return (<>
        <div className="viz-header">
            <div>
                <div className="data-panel-title">
                    {dataset === "comm" ? selectedArea : `${selectedArea} County`}
                </div>
                <div className="data-panel-subtitle">
                    {tableRows.length} record{tableRows.length !== 1 ? "s" : ""}&nbsp;&mdash;&nbsp;Total {formatCurrency(tableTotal)}
                </div>
            </div>
            <button className="data-panel-close" onClick={() => resetFiltersOnClose()}>✕</button>
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
    </>)
}
    
    