/*import { ExtentsRow } from "../extents/ExtentsDashboard";
import { DataRow } from "../fisheries/FisheriesDashboard";

export function establishFilterRange(data: DataRow[]|ExtentsRow[]) {
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
}*/