import FisheriesDashboard2 from "../fisheries/FisheriesDashboard2";
import ExtentsDashboard2 from "../extents/ExtentsDashboard2";
import MarineDashboard2 from "../marine/MarineDashboard2";
import LeftSidebar from "./LeftSidebar";
import { useState } from "react";
import { IBM_Plex_Sans } from 'next/font/google'

const fnt = IBM_Plex_Sans({weight: "400"})

export interface FilterStatus {
    filterShown: boolean,
    xPos: number,
    yPos: number,
}

export default function DashboardFINAL() {
    // fisheries, extents, or recreation (coming soon)
    const [layer, setLayer] = useState<"fisheries" | "extents">("fisheries");
    
    // switching datasets within layers (e.g. fisheries has 'noncomm' and 'comm' datasets)
    const [dataset, setDataset] = useState("noncomm")

    // determine if the filter is shown
    const [filterInfo, setFilterInfo] = useState<FilterStatus>({
        filterShown: false,
        xPos: -1,
        yPos: -1,
    })

    const updateFilterStatus = (filterShown: boolean, xPos: number, yPos: number) => {
        setFilterInfo({ filterShown, xPos, yPos })
    }

    return (
        <div className={fnt.className}>
            <div style = {{display: "flex", height: "100vh", overflow: "hidden"}}>
                {/* Left nav */}
                <LeftSidebar
                    layer={layer}
                    setLayer={setLayer}
                    datatype={dataset}
                    setDatatype={setDataset}
                    onFilterShownChange={updateFilterStatus}
                />

                <div style={{flexGrow: 1}}>
                    <div style={{display: (layer == "fisheries" && dataset == "noncomm") ? "block" : "none"}}>
                        <FisheriesDashboard2 
                            dataType="noncomm"
                            filterStatus={filterInfo} 
                            showMap={layer == "fisheries" && dataset == "noncomm"}
                        />
                    </div>

                    <div style={{display: (layer == "fisheries" && dataset == "comm") ? "block" : "none"}}>
                        <FisheriesDashboard2 
                            dataType="comm" 
                            filterStatus={filterInfo} 
                            showMap={layer == "fisheries" && dataset == "comm"}
                        />
                    </div>
                    <div style={{display: (layer == "extents" && dataset == "terrestrial") ? "block" : "none"}}>
                        <ExtentsDashboard2 
                            filterStatus={filterInfo} 
                            showMap={layer == "extents" && dataset == "terrestrial"}
                        />
                    </div>
                    <div style={{display: (layer == "extents" && dataset == "marine") ? "block" : "none"}}>
                        <MarineDashboard2 
                            filterStatus={filterInfo} 
                            showMap={layer == "extents" && dataset == "marine"}
                        />
                    </div>     
                </div>
            </div>
        </div>
    )
}