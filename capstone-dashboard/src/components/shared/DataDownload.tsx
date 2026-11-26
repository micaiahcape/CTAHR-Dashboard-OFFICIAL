import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import styles from "@/css/download.module.css"

export default function DataDownload () {
    /*
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
    };*/

    return (
        <div className={styles["download-body"]}>
            <div>

            </div>
            <div className={styles["download-btn"]}>
                <div className={styles["download-icon-holder"]}>
                    <FontAwesomeIcon icon={faDownload} className={styles["download-icon"]}/>
                </div>
                <p className={styles["download-text"]}>Download data</p>
                
            </div>
        </div>
    )
}