/*
 * Main dashboard component. Loads fisheries and ecosystem extents GeoJSON data,
 * manages all filter state (year range, county, species, ecosystem type, moku),
 * aggregates exchange values and area totals per region, and orchestrates the
 * map, filter sidebar, and data visualization panels. Also handles CSV download
 * for both the fisheries and extents datasets.
 */
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "./dashboard.css";
import FilterSidebar from "./FilterSidebar";
import FisheriesFilterMenu from "../fisheries/FisheriesFilterMenu";
import { StringDecoder } from "node:string_decoder";

const Map = dynamic(() => import("../map/Map"), { ssr: false });

interface DashboardProps {
  geoJsonPath: string;
  datasetLabel: string;
}

interface DataRow {
  year: number;
  county: string;
  area_id: string;
  species_group: string;
  ecosystem_type: string;
  exchange_value: number;
}

interface ExtentsRow {
  year: number;
  moku_olelo: string;
  island_olelo: string;
  moku_key: string; // "moku_olelo (island_olelo)" — globally unique
  realm: string;
  ecosystem_type: string;
  area_km2: number;
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

function normalizeCounty(raw: string): string {
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

function parseNoncommGeoJSON(geojson: GeoJSON): DataRow[] {
  return geojson.features
    .map((feat: GeoFeature) => {
      const p = feat.properties;
      const county = normalizeCounty(String(p.county ?? ""));
      return {
        year: Number(p.year),
        county,
        area_id: county,
        species_group: String(p.species_group ?? ""),
        ecosystem_type: String(p.ecosystem_type ?? ""),
        exchange_value: Number(p.exchange_value) || 0,
      } as DataRow;
    })
    .filter((r: DataRow) => (r.exchange_value > 0 && r.species_group != "All Species" && r.ecosystem_type != "All Ecosystems"));
}

/*******************
 * Returns rows like this:
 * 
 * [{year: <year>, county: <county>, area_id: <area_id>, species_group: <species_group>, ecosystem_type: <ecosystem_type>, exchange_value: <exchange_value>}, 
 * {year: <year>, county: <county>, area_id: <area_id>, species_group: <species_group>, ecosystem_type: <ecosystem_type>, exchange_value: <exchange_value>}, {...}, ...]
 * 
 ************************/

function parseCommGeoJSON(geojson: GeoJSON): DataRow[] {
  const rows: DataRow[] = [];
  for (const feat of geojson.features) {
    const p = feat.properties;
    const county = normalizeCounty(String(p.county_olelo ?? ""));
    const toArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
    const years = toArr(p.year).map(Number);
    const species = toArr(p.species_group).map(String);
    const ecosystems = toArr(p.ecosystem_type).map(String);
    const values = toArr(p.exchange_value).map(Number);

    for (let i = 0; i < years.length; i++) {
      const val = Number(values[i]) || 0;
      if (val <= 0 || species[i] === "All Species" || ecosystems[i] === "All Ecosystems") continue;
      // to prevent double counting, we skip rows that are "All Species" or "All Ecosystems." These values are broken down by specific species and specific ecosystems, which we could use to tally up.
      
      rows.push({
        year: Number(years[i]),
        county,
        area_id: String(p.area_id ?? ""),
        species_group: species[i],
        ecosystem_type: ecosystems[i],
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

export default function EcosystemDashboard({ geoJsonPath, datasetLabel }: DashboardProps) {
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [rowData, setRowData] = useState<DataRow[]>([]);
  const [dataset, setDataset] = useState("noncomm");
  const [showRawData, setShowRawData] = useState(false);
  const [selectedArea, setSelectedArea] = useState("");
  const [activeTab, setActiveTab] = useState<"filter" | "viz">("filter");

  // Fisheries filters
  const [selectedYearStart, setSelectedYearStart] = useState<number | null>(null);
  const [selectedYearEnd, setSelectedYearEnd] = useState<number | null>(null);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [selectedEcosystem, setSelectedEcosystem] = useState("");

  // Layer toggle
  const [layer, setLayer] = useState<"fisheries" | "extents">("fisheries");

  // Extents data + filters
  const [extentsData, setExtentsData] = useState<ExtentsRow[]>([]);
  const [extentsGeoData, setExtentsGeoData] = useState<GeoJSON | null>(null);
  const [selectedExtentsYearStart, setSelectedExtentsYearStart] = useState<number | null>(2013);
  const [selectedExtentsYearEnd, setSelectedExtentsYearEnd] = useState<number | null>(2019);
  const [selectedExtentsEcosystem, setSelectedExtentsEcosystem] = useState("");
  const [selectedExtentsMoku, setSelectedExtentsMoku] = useState("");

  const [downloadCounty, setDownloadCounty] = useState("");
  const [downloadMode, setDownloadMode] = useState<"ALL_SEPARATE" | "ONE_COUNTY">("ONE_COUNTY");
  const [downloadExtentsMokus, setDownloadExtentsMokus] = useState<string[]>([]);
  const [downloadExtentsEcosystems, setDownloadExtentsEcosystems] = useState<string[]>([]);

  // Load fisheries data
  useEffect(() => {
    async function loadData() {
      const [geoRes, dataRes] = await Promise.all([
        fetch(geoJsonPath),
        fetch(
          dataset === "noncomm"
            ? "/fisheriesdata/20260216_tidied_noncomm_ev.geojson"
            : "/fisheriesdata/comm_EV_byCatchmentArea_09182026.geojson"
        ),
      ]);

      const [geo, dataGeo] = await Promise.all([geoRes.json(), dataRes.json()]);

      const rows =
        dataset === "noncomm"
          ? parseNoncommGeoJSON(dataGeo)
          : parseCommGeoJSON(dataGeo);

      // const rows = parseCommGeoJSON(dataGeo);

      console.log(rows)

      setGeoData(dataset === "comm" ? dataGeo : geo);
      setRowData(rows);

      const speciesValues = [...new Set(rows.map((r) => r.species_group))].sort();
      const ecoValues = [...new Set(rows.map((r) => r.ecosystem_type))].sort();

      // because we excluded "All Species" and "All Ecosystems" when creating rowData, we need to add them back in for the pickDefault function below.

      if (speciesValues.length > 1) {
        speciesValues.unshift("All Species");
      }

      if (ecoValues.length > 1) {
        ecoValues.unshift("All Ecosystems");
      }

      const pickDefault = (values: string[], aggregateLabel: string) =>
        values.includes(aggregateLabel) ? aggregateLabel : values[0] ?? "";

      setSelectedCounty("");
      setSelectedYearStart(null);
      setSelectedYearEnd(null);
      setSelectedSpecies(pickDefault(speciesValues, "All Species"));
      setSelectedEcosystem(pickDefault(ecoValues, "All Ecosystems"));
      setShowRawData(false);
      setSelectedArea("");
      setActiveTab("filter");
    }

    loadData();
  }, [dataset, layer, geoJsonPath]);

  // Load extents data once on mount
  useEffect(() => {
    async function loadExtents() {
      console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
      const res = await fetch("/mokuextentsdata/20261007_terrestrial_extents_byMoku.geojson");
      const geo = await res.json();

      const rows: ExtentsRow[] = []

      for (const feat of geo.features) {
        let f = feat.properties
        for (let i = 0; i < feat.properties.year.length; i++) {
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
      console.log(rows);
      setExtentsData(rows);
      setExtentsGeoData(geo);
    }
    loadExtents();
  }, []);

  if (!geoData) return <div>Loading {datasetLabel}...</div>;

  // ----------------------------------
  // Fisheries derived values
  // ----------------------------------
  const counties = [...new Set(rowData.map((d) => d.county))].sort();
  const years = [...new Set(rowData.map((d) => d.year))].sort((a, b) => a - b);
  const speciesGroups = [...new Set(rowData.map((d) => d.species_group))].sort();
  const ecosystemTypes = [...new Set(rowData.map((d) => d.ecosystem_type))].sort();

  // because we excluded "All Species" and "All Ecosystems" when creating rowData, we need to add them back in for filter dropdowns.
  if (speciesGroups.length > 1) {
    speciesGroups.unshift("All Species");
  }
  
  if (ecosystemTypes.length > 1) {
    ecosystemTypes.unshift("All Ecosystems");
  }

  const handleFilterChange = (yearStart: number, yearEnd: number, county: string, species: string, ecosystem: string) => {
    setSelectedYearStart(yearStart);
    setSelectedYearEnd(yearEnd);
    setSelectedCounty(county);
    setSelectedSpecies(species);
    setSelectedEcosystem(ecosystem);
  }


  const filteredFisheryRows = rowData.filter((row) => {
    return (
      (selectedYearStart === null || row.year >= selectedYearStart) &&
      (selectedYearEnd === null || row.year <= selectedYearEnd) &&
      (selectedCounty === "" || row.county === selectedCounty) &&
      // when it's "All Species" or "All Ecosystems", the code "short circuits" and returns all species rows and/or ecosystem rows.
      (selectedSpecies === "All Species" || row.species_group === selectedSpecies) &&
      (selectedEcosystem === "All Ecosystems" || row.ecosystem_type === selectedEcosystem)
    );
  });

  const filteredTotalsById: Record<string, number> = {};
  filteredFisheryRows.forEach((row) => {
    filteredTotalsById[row.area_id] = (filteredTotalsById[row.area_id] || 0) + row.exchange_value;
  });

  const aggregatedGeoJSON = {
    ...geoData,
    features: geoData.features
      .map((feature: GeoFeature) => {
        const key = dataset === "comm"
          ? String(feature.properties.area_id ?? "")
          : String(feature.properties.county ?? "");
        return {
          ...feature,
          properties: {
            ...feature.properties,
            total_exchange_value: filteredTotalsById[key] || 0,
          },
        };
      })
      .filter((feature: GeoFeature) =>
        (feature.properties.total_exchange_value as number) > 0
      ),
  };

  // ----------------------------------
  // Extents derived values
  // ----------------------------------

  const extentsYears = [...new Set(extentsData.map((d) => d.year))].sort((a, b) => a - b);
  const extentsEcosystems = [...new Set(extentsData.map((d) => d.ecosystem_type))].sort();
  const extentsMokus = [...new Set(extentsData.map((d) => d.moku_key))].sort();

  const filteredExtentsRows = extentsData.filter((row) => {
    return (
      ((selectedExtentsYearStart === null || row.year === selectedExtentsYearStart) ||
      (selectedExtentsYearEnd === null || row.year === selectedExtentsYearEnd)) &&
      (selectedExtentsEcosystem === "" || row.ecosystem_type === selectedExtentsEcosystem)
    );
  });

  console.log(extentsData)
  const changesByMoku: any = {};
  if (selectedExtentsYearStart === selectedExtentsYearEnd) {
    // view for just that year
  } else {
    filteredExtentsRows.forEach(i => {
      const o = changesByMoku[i.moku_key] ? changesByMoku[i.moku_key] : {}
      o[i.year] = i.area_km2
      changesByMoku[i.moku_key] = o;
    })
  }

  Object.keys(changesByMoku).forEach((k) => {
    const first = changesByMoku[k][String(selectedExtentsYearStart)] 
    const last = changesByMoku[k][String(selectedExtentsYearEnd)]
    const abs_change = last - first
    changesByMoku[k].absolute_change = abs_change
    changesByMoku[k].relative_change = first != 0 ? (abs_change / first) * 100 : 0
    changesByMoku[k].firstYear = first;
    changesByMoku[k].lastYear = last;
  })

  console.log(changesByMoku)

  console.log(extentsGeoData)

  // aggregate into GeoJSON

  const aggregatedExtentsGeoJSON = {...extentsGeoData,
    features: extentsGeoData?.features.map(feat => {
      const specific_moku = changesByMoku[`${feat.properties.moku_olelo}_${feat.properties.island_olelo}`]
      return ({
        ...feat,
        properties: {
          moku: feat.properties.moku_olelo,
          island: feat.properties.island_olelo,
          relative_change: specific_moku.relative_change,
          absolute_change: specific_moku.absolute_change,
          year1Value: specific_moku.firstYear,
          year2Value: specific_moku.lastYear,
          year1: selectedExtentsYearStart,
          year2: selectedExtentsYearEnd,
          ecosystem_type: selectedExtentsEcosystem,
        }
      })
    })
  }

  // Active map data — switch based on layer
  const activeGeoData =
    layer === "extents" && aggregatedExtentsGeoJSON ? aggregatedExtentsGeoJSON : aggregatedGeoJSON;

  //const activeGeoData = aggregatedGeoJSON

  const computedColorThresholds = (() => {
    let sorted: number[]
    if (layer === "fisheries") {
      sorted = Object.values(filteredTotalsById).sort((a, b) => a - b);
      const percent1 = Math.round(sorted[Math.floor(sorted.length * 0.1)])
      const percent9 = Math.round(sorted[Math.floor(sorted.length * 0.9)])
      return [percent1, percent9]

    } else if (layer === "extents") {
      sorted = Object.values(changesByMoku).map((e: any) => e.relative_change).sort((a, b) => a - b);
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
    }
    return [0, 0]
  }) ();

  // ----------------------------------
  // Download helpers
  // ----------------------------------
  function buildCsvFromRows(rowsForCsv: DataRow[]) {
    if (rowsForCsv.length === 0) return "";
    const cols: (keyof DataRow)[] = ["year", "county", "species_group", "ecosystem_type", "exchange_value"];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(","), ...rowsForCsv.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
  }

  function triggerCsvDownload(filename: string, contents: string) {
    const blob = new Blob(["\uFEFF" + contents.replace(/\n/g, "\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const handleDownload = (mode: "ALL_SEPARATE" | "ONE_COUNTY", county?: string) => {
    const safe = (s: string) => s.replace(/[^\w\-]+/g, "_");
    const yearLabel =
      selectedYearStart || selectedYearEnd
        ? `${selectedYearStart ?? "start"}-${selectedYearEnd ?? "end"}`
        : "all-years";
    const base = [yearLabel, selectedSpecies || "all-species", selectedEcosystem || "all-ecosystems"];

    if (mode === "ONE_COUNTY") {
      if (!county) return;
      const csv = buildCsvFromRows(filteredFisheryRows.filter((r) => r.county === county));
      triggerCsvDownload(`${[dataset, safe(county), ...base].join("_")}.csv`, csv);
      return;
    }

    const grouped: Record<string, DataRow[]> = {};
    filteredFisheryRows.forEach((r) => {
      (grouped[r.county || "Unknown"] ||= []).push(r);
    });
    Object.entries(grouped).forEach(([c, rows], i) => {
      const csv = buildCsvFromRows(rows);
      window.setTimeout(
        () => triggerCsvDownload(`${[dataset, safe(c), ...base].join("_")}.csv`, csv),
        i * 250
      );
    });
  };

  const handleExtentsDownload = () => {
    const safe = (s: string) => s.replace(/[^\w\-]+/g, "_");
    const mokusToDownload = downloadExtentsMokus.length > 0 ? downloadExtentsMokus : null;
    const ecosToDownload = downloadExtentsEcosystems.length > 0 ? downloadExtentsEcosystems : null;

    const rows = extentsData.filter((r) => {
      return (
        (mokusToDownload === null || mokusToDownload.includes(r.moku_key)) &&
        (ecosToDownload === null || ecosToDownload.includes(r.ecosystem_type))
      );
    });

    const cols: (keyof ExtentsRow)[] = ["year", "moku_olelo", "island_olelo", "realm", "ecosystem_type", "area_km2"];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");

    const mokusLabel = mokusToDownload ? safe(mokusToDownload.join("-")).slice(0, 40) : "all-mokus";
    const ecosLabel = ecosToDownload ? safe(ecosToDownload.join("-")).slice(0, 40) : "all-ecosystems";
    triggerCsvDownload(`extents_${mokusLabel}_${ecosLabel}.csv`, csv);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  const handleAreaClick = (areaId: string) => {
    const next = selectedArea === areaId ? "" : areaId;
    setSelectedArea(next);
    setShowRawData(false);
    if (next !== "") setActiveTab("viz");
  };

  // ----------------------------------
  // Viz panel data
  // ----------------------------------
  const panelRows = selectedArea
    ? filteredFisheryRows.filter((r) => r.area_id === selectedArea)
    : [];

  const byYear: Record<number, number> = {};
  const bySpecies: Record<string, number> = {};
  const byEcosystem: Record<string, number> = {};

  panelRows.forEach((row) => {
    byYear[row.year] = (byYear[row.year] || 0) + row.exchange_value;
    bySpecies[row.species_group] = (bySpecies[row.species_group] || 0) + row.exchange_value;
    byEcosystem[row.ecosystem_type] = (byEcosystem[row.ecosystem_type] || 0) + row.exchange_value;
  });

  const yearEntries = Object.entries(byYear)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort(([a], [b]) => a - b);

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

  // Extents viz panel data — uses filteredExtentsRows which already has year range applied
  const extentsPanelRows = selectedArea
    ? filteredExtentsRows.filter((r) => r.moku_key === selectedArea)
    : [];

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

  return (
    <div className="dashboard-container">

      {/* Left nav */}
      <FilterSidebar
        layer={layer}
        setLayer={setLayer}
        datatype={dataset}
        setDatatype={setDataset}
        onLayerChange={() => setSelectedArea("")}
      />

      {/* Map */}
      <div className="central-panel">
        <div className="summary-display">
          {(layer === "fisheries") ? (
            <p>{(dataset == "comm") ? "Commercial" : "Non-commercial"} fisheries data, with <span className="summary-highlight">{(selectedSpecies === "All Species") ? "ALL" : selectedSpecies.toLocaleLowerCase()}</span> species and <span className="summary-highlight">{(selectedEcosystem === "All Ecosystems") ? "ALL" : selectedEcosystem.toLocaleLowerCase()}</span> ecosystems: {selectedYearStart || years[0]}-{selectedYearEnd || years[years.length-1]}</p>
          ) : (
            <p>Ecosystem extents data, with <span className="summary-highlight">{(selectedExtentsEcosystem === "") ? "ALL" : selectedExtentsEcosystem.toLocaleLowerCase()}</span> ecosystems: {selectedYearStart || years[0]}-{selectedYearEnd || years[years.length-1]}</p>
          )}
          
        </div>

        {activeGeoData && <Map
          mapType={dataset}
          layerType={layer}
          geoData={activeGeoData}
          selectedCounty={selectedArea}
          selectedYearStart={selectedYearStart}
          selectedYearEnd={selectedYearEnd}
          selectedSpecies={selectedSpecies}
          selectedEcosystem={layer === "extents" ? selectedExtentsEcosystem : selectedEcosystem}
          onCountyClick={handleAreaClick}
          outliers={computedColorThresholds}
        />}
      </div>
      
      {/* Right panel */}
      <div className="right-panel">

        {/* Tab header */}
        <div className="right-panel-tabs">
          <button
            className={`rp-tab ${activeTab === "filter" ? "active" : ""}`}
            onClick={() => setActiveTab("filter")}
          >
            Filter
          </button>
          <button
            className={`rp-tab ${activeTab === "viz" ? "active" : ""}`}
            onClick={() => setActiveTab("viz")}
          >
            Data View
          </button>
        </div>

        {/* ── FILTER TAB ── */}
        {activeTab === "filter" && (
          <div className="rp-content">

            {/* ── EXTENTS FILTERS ── */}
            {layer === "extents" && (
              <>
                {/* Reset */}
                <div className="rp-section">
                  <button
                    className="filter-btn"
                    style={{ width: "100%" }}
                    onClick={() => {
                      setSelectedExtentsMoku("");
                      setSelectedExtentsYearStart(null);
                      setSelectedExtentsYearEnd(null);
                      setSelectedExtentsEcosystem("");
                    }}
                  >
                    ↺ Reset Filters
                  </button>
                </div>

                <div className="rp-section">
                  <div className="filter-label">Moku</div>
                  <select
                    className="filter-select"
                    value={selectedExtentsMoku}
                    onChange={(e) => setSelectedExtentsMoku(e.target.value)}
                  >
                    <option value="">All Moku</option>
                    {extentsMokus.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="rp-section">
                  <div className="filter-label">Year Range</div>
                  <div className="year-range-row">
                    <select
                      className="filter-select"
                      value={selectedExtentsYearStart ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setSelectedExtentsYearStart(val);
                        if (val !== null && selectedExtentsYearEnd !== null && val > selectedExtentsYearEnd) {
                          setSelectedExtentsYearEnd(null);
                        }
                      }}
                    >
                      <option value="">Start</option>
                      {extentsYears.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="year-range-arrow">→</span>
                    <select
                      className="filter-select"
                      value={selectedExtentsYearEnd ?? ""}
                      onChange={(e) =>
                        setSelectedExtentsYearEnd(e.target.value === "" ? null : Number(e.target.value))
                      }
                    >
                      <option value="">End</option>
                      {extentsYears
                        .filter((y) => selectedExtentsYearStart === null || y >= selectedExtentsYearStart)
                        .map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rp-section">
                  <div className="filter-label">Ecosystem Type</div>
                  <div className="filter-sublabel">Marine</div>
                  {/*<div className="button-group" style={{ marginBottom: 8 }}>
                    {[...MARINE_ECOSYSTEMS].sort().map((e) => (
                      <button
                        key={e}
                        className={`filter-btn ${selectedExtentsEcosystem === e ? "active" : ""}`}
                        onClick={() => setSelectedExtentsEcosystem(selectedExtentsEcosystem === e ? "" : e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div> */}
                  <div className="filter-sublabel mt">Terrestrial</div>
                  <div className="button-group">
                    {[...extentsEcosystems].sort().map((e) => (
                      <button
                        key={e}
                        className={`filter-btn ${selectedExtentsEcosystem === e ? "active" : ""}`}
                        onClick={() => setSelectedExtentsEcosystem(selectedExtentsEcosystem === e ? "" : e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extents Download */}
                <div className="rp-section">
                  <div className="filter-label">Download CSV</div>

                  <div className="filter-sublabel mt">
                    Moku (hold Ctrl/⌘ to select multiple)
                  </div>
                  <select
                    multiple
                    className="filter-select"
                    style={{ height: 100 }}
                    value={downloadExtentsMokus}
                    onChange={(e) =>
                      setDownloadExtentsMokus(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                  >
                    {extentsMokus.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  <div className="filter-sublabel mt">
                    Ecosystem (hold Ctrl/⌘ to select multiple)
                  </div>
                  <select
                    multiple
                    className="filter-select"
                    style={{ height: 100 }}
                    value={downloadExtentsEcosystems}
                    onChange={(e) =>
                      setDownloadExtentsEcosystems(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                  >
                    {extentsEcosystems.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      className="filter-btn"
                      style={{ flex: 1 }}
                      onClick={() => { setDownloadExtentsMokus([]); setDownloadExtentsEcosystems([]); }}
                    >
                      Clear
                    </button>
                    <button
                      className="filter-btn"
                      style={{ flex: 2 }}
                      onClick={handleExtentsDownload}
                    >
                      Download CSV
                    </button>
                  </div>
                  <div className="filter-hint">
                    No selection = all mokus / all ecosystems
                  </div>
                </div>
              </>
            )}

            {/* ── FISHERIES FILTERS ── */}
            {layer === "fisheries" && 
              <FisheriesFilterMenu 
                key={dataset} // force a rerender when dataset changes.
                speciesGroups={speciesGroups}
                ecosystemTypes={ecosystemTypes}
                yearRange={[years[0], years[years.length-1]]}
                counties={counties}
                onChangeFilter={handleFilterChange}
              />
            }

          </div>
        )}

        {/* ── VIZ TAB ── */}
        {activeTab === "viz" && (
          <div className="rp-content">
            {!selectedArea ? (
              <div className="rp-empty">
                <div className="rp-empty-icon">◎</div>
                <div className="rp-empty-text">Click a region on the map to view its data</div>
              </div>
            ) : layer === "extents" ? (
              /* ── EXTENTS VIZ ── */
              <>
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
                  <button className="data-panel-close" onClick={() => {
                    setSelectedArea("");
                    setSelectedExtentsMoku("");
                    setSelectedExtentsYearStart(null);
                    setSelectedExtentsYearEnd(null);
                    setSelectedExtentsEcosystem("");
                  }}>✕</button>
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
              </>
            ) : (
              /* ── FISHERIES VIZ (unchanged) ── */
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
                    setSelectedCounty("");
                    setSelectedYearStart(null);
                    setSelectedYearEnd(null);
                    setSelectedSpecies("");
                    setSelectedEcosystem("");
                  }}>✕</button>
                </div>

                {(() => {
                  const fishAccent = trendPct !== null && trendIsUp ? "#4caf82" : "#d94801";
                  return (
                    <>
                      <div
                        className="metric-hero-card"
                        style={trendPct !== null ? { borderLeftColor: fishAccent } : undefined}
                      >
                        <div
                          className="metric-hero-value"
                          style={trendPct !== null ? { color: fishAccent } : undefined}
                        >
                          {formatCurrency(tableTotal)}
                        </div>
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
                        </div>
                      )}
                    </>
                  );
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
                  </div>
                )}

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
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
