import FisheriesDashboard2 from "../fisheries/FisheriesDashboard2";
import ExtentsDashboard2 from "../extents/ExtentsDashboard2";
import FilterSidebar from "./FilterSidebar";
import MarineDashboard from "../marine/MarineDashboard";
import { useState } from "react";
import { IBM_Plex_Sans } from 'next/font/google'

const fnt = IBM_Plex_Sans({weight: "400"})

export default function DashboardFINAL() {
    // fisheries, extents, or recreation (coming soon)
    const [layer, setLayer] = useState<"fisheries" | "extents">("fisheries");
    
    // switching datasets within layers (e.g. fisheries has 'noncomm' and 'comm' datasets)
    const [dataset, setDataset] = useState("noncomm")

    return (
        <div className={fnt.className}>
            <div className="dashboard-container" >
                {/* Left nav */}
                <FilterSidebar
                    layer={layer}
                    setLayer={setLayer}
                    datatype={dataset}
                    setDatatype={setDataset}
                />

                {layer == "fisheries" && <FisheriesDashboard2 dataType={dataset} key={dataset}/>}
                {(layer == "extents" && dataset == "terrestrial") && <ExtentsDashboard2 />}
                {(layer == "extents" && dataset == "marine") && <MarineDashboard dataset={dataset}/>}
            </div>
        </div>
    )
}