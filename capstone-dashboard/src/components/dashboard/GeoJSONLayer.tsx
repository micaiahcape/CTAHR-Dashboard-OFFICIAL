import { useEffect, useRef, useState} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ColorThresholds {
    colors: string[],
    thresholds: number[],
}

interface GeoJSONLayerProps {
    geoData: any,
    filter: Record<string, any>,
    colorBreakdowns: ColorThresholds,
    selectedArea: string,
    onCountyClickFn?: (area: string) => void,
    toolTipFn: (feat: any, appliedFilters: Record<string, any>, colorThresholds: ColorThresholds) => React.ReactNode,
}

export default function GeoJSONLayer ({
    geoData,
    filter,
    colorBreakdowns,
    selectedArea,
    onCountyClickFn,
    toolTipFn,
} : GeoJSONLayerProps) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);

    const getColor = (value: number) => {
        let index = 0;
        while (value > colorBreakdowns.thresholds[index] && index < colorBreakdowns.thresholds.length) {
            index++;
        }
        return colorBreakdowns.colors[index];
    }
    
    useEffect(() => {
        if (layerRef.current) {
            layerRef.current.remove();
            layerRef.current = null;
        }
        
        const geojsonLayer = L.geoJSON(geoData, {
            style: (feature) => {
                const value = Number(feature?.properties?.value) || 0;
                const featureKey = feature?.properties?.name
                const isSelected = selectedArea !== "" && featureKey === selectedArea;
                return {
                    fillColor: value != 0 ? getColor(value) : "#b5bdc9",
                    fillOpacity: isSelected ? 0.5 : 0.8,
                    color: isSelected ? "#aeff00" : "white",
                    weight: isSelected ? 5 : 1,
                };
            },
        
            onEachFeature: (feature, layer) => {
                const label = feature?.properties?.name

                // convert the tooltip content to a string using renderToStaticMarkup
                const toolTipContent = renderToStaticMarkup(toolTipFn(feature, filter, colorBreakdowns))

                layer.bindTooltip(toolTipContent, { sticky: true });
        
                layer.on({
                    click: () => {
                        onCountyClickFn?.(String(label ?? ""));
                    },
                    mouseover: (e: L.LeafletMouseEvent) => {
                        e.target.setStyle({ fillOpacity: 0.5 });
                    },
                    mouseout: (e: L.LeafletMouseEvent) => {
                        const isSel = selectedArea !== "" && label === selectedArea;
                        e.target.setStyle({ fillOpacity: isSel ? 0 : 0.8 });
                    },
                });
            },
        });
    
        geojsonLayer.addTo(map);
        layerRef.current = geojsonLayer;
    
        return () => {
            if (layerRef.current) {
                layerRef.current.remove();
                layerRef.current = null;
            }
        };
    }, [geoData, selectedArea, filter, colorBreakdowns]);
    
    return null;
}