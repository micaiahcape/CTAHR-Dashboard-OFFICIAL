import FisheriesDashboard from "../fisheries/FisheriesDashboard";
import FilterSidebar from "./FilterSidebar";
import { useState } from "react";

export default function DashboardFINAL() {
    // fisheries, extents, or recreation (coming soon)
    const [layer, setLayer] = useState<"fisheries" | "extents">("fisheries");
    
    // switching datasets within layers (e.g. fisheries has 'noncomm' and 'comm' datasets)
    const [dataset, setDataset] = useState("noncomm")

    return (
        <div className="dashboard-container">
            {/* Left nav */}
            <FilterSidebar
                layer={layer}
                setLayer={setLayer}
                datatype={dataset}
                setDatatype={setDataset}
            />

            <FisheriesDashboard dataset={dataset}/>
        </div>
    )
}