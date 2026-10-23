/*
 * Leaflet map component. Renders a choropleth layer over Hawaii using GeoJSON
 * data for either the fisheries or ecosystem extents layer. Colors are assigned
 * via a quintile scale (stable thresholds passed from the parent so colors don't
 * shift when filters change). Tooltips show region name, value, and active
 * filter context. Clicking a region fires onCountyClick to open the viz panel.
 */
"use client";

import { useEffect, useRef, useState} from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { GeoJsonObject } from "geojson";
import { FisheryFilterSettings } from "../fisheries/FisheriesDashboard";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const Legend = dynamic(() => import("../map/Legend"), { ssr: false });

type LayerType = "fisheries" | "extents";
type FeatureValueField = "relative_change" | "absolute_change" | "total_exchange_value";

interface DashboardFeatureProperties {
  [key: string]: unknown;
}

interface DashboardGeoFeature {
  type: string;
  properties: DashboardFeatureProperties;
  geometry: unknown;
}

export interface DashboardGeoJSON {
  type: string;
  features: DashboardGeoFeature[];
}

interface MapProps {
  mapType: string;
  selectedArea: string;
  layerType: LayerType;
  geoData: DashboardGeoJSON;
  appliedFilters: FisheryFilterSettings;
  onCountyClick: (county: string) => void;
  outliers: [number, number]; // an array containing two numbers: the 10th and 90th percentiles. Any number that falls on either side of that extreme will default to the color on that end. Otherwise, the color will be calculated by linear interpolation.
}

// accepts two colors in hex format, and outputs an interpolated color
function interpolate(clr1: string, clr2: string, val: number) {
  const r1 = parseInt(clr1.substring(1, 3), 16);
  const g1 = parseInt(clr1.substring(3, 5), 16);
  const b1 = parseInt(clr1.substring(5, 7), 16);

  const r2 = parseInt(clr2.substring(1, 3), 16);
  const g2 = parseInt(clr2.substring(3, 5), 16);
  const b2 = parseInt(clr2.substring(5, 7), 16);

  let rFinal = Math.round(r1 + (r2 - r1) * val);
  let gFinal = Math.round(g1 + (g2 - g1) * val);
  let bFinal = Math.round(b1 + (b2 - b1) * val);

  return `#${rFinal.toString(16).padStart(2, "0")}${gFinal.toString(16).padStart(2, "0")}${bFinal.toString(16).padStart(2, "0")}`
}

function getContrastColor(hexColor: string) {
  // Remove '#' if present
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  const luminance = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];

  // Luminance threshold is ~0.179
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

function GeoJSONLayer({
  mapType,
  layerType,
  geoData,
  appliedFilters,
  colorList,
  numericalThresholds,
  selectedArea,
  onCountyClick,
}: Omit<MapProps, "layerType" | "outliers"> & { layerType: LayerType, colorList: string[], numericalThresholds: number[] }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  const getColor = (value: number) => {
    let index = 0;
    while (value > numericalThresholds[index] && index < numericalThresholds.length) {
      index++;
    }
    return colorList[index];
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    const field: FeatureValueField = layerType === "extents" ? "relative_change" : "total_exchange_value";
    const isExtents = layerType === "extents";

    const geojsonLayer = L.geoJSON(geoData as GeoJsonObject, {
      style: (feature) => {
        const value = Number(feature?.properties?.[field]) || 0;
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
        const value = Number(feature?.properties?.[field]) || 0;
        const label = feature.properties.name
        
        let formattedValue: String = "";
        if (isExtents) {
          if (value > 0) {
            formattedValue = `▲ ${value.toFixed(2)}%`
          } else if (value < 0) {
            formattedValue = `▼ ${(0-value).toFixed(2)}%`
          } else if (value == 0) {
            formattedValue = `No Change`
          }
        } else {
          formattedValue = formatCurrency(value)
        }

        const bgcolor = value != 0 ? getColor(value) : "#b5bdc9"

        const tooltipContent = `
          <div style="font-size: 13px">
            <strong>${label}</strong><br/>
            ${isExtents ? (
              `${feature.properties.year1} area: ${feature.properties.year1Value} km<sup>2</sup> <br/>
              <div style="display: flex">
                <p style="margin: auto 6px auto 0;">${feature.properties.year2} area: ${feature.properties.year2Value} km<sup>2</sup></p>
                <b style="background-color: ${bgcolor}; color: ${getContrastColor(bgcolor)}; padding: 1px 2px; font-size: 15px">${formattedValue}</b>
              </div>`
            ) : (
              `Exchange Value: <b>${formattedValue}</b>`
            )}<br/>
            ${isExtents
              ? `Ecosystem: ${appliedFilters.ecosystem || "All"}`
              : `Year: ${appliedFilters.startYear || appliedFilters.endYear
                  ? `${appliedFilters.startYear ?? "start"} – ${appliedFilters.endYear ?? "end"}`
                  : "All Years"
                }<br/>
                 Species: ${appliedFilters.species|| "All"}<br/>
                 Ecosystem: ${appliedFilters.ecosystem|| "All"}`
            }
          </div>
        `;

        layer.bindTooltip(tooltipContent, { sticky: true });

        layer.on({
          click: () => {
            onCountyClick?.(String(label ?? ""));
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
  }, [geoData, layerType, mapType, appliedFilters, selectedArea, getColor, onCountyClick, map]);

  return null;
}

export default function Map({
  mapType,
  layerType,
  geoData,
  appliedFilters,
  outliers,
  selectedArea,
  onCountyClick,
}: MapProps) {
  const position: LatLngExpression = [20.5, -157.5];

  const defaultColorRange: [string, string] = layerType == "fisheries" ? ["#FFFFFF", "#ff3300"] : ["#0362fc", "#ff3300"]

  const [numWholeSegments, setNumWholeSegments] = useState<number>(layerType == "fisheries" ? 2 : 4)
  const [colorRange, setColorRange] = useState<[string, string]>(defaultColorRange)

  useEffect(() => {
    if (layerType === "extents") {
      setColorRange(["#0362fc", "#ff3300"])
    } else if (layerType === "fisheries") {
      setColorRange(["#FFFFFF", "#ff3300"])
    }
  }, [layerType])

  // only updates when user presses "submit."
  const handleColorChange = (clr1: string, clr2: string) => {
    const newArray: [string, string] = [clr1, clr2]
    setColorRange(newArray)
  }

  // updates whenever user drags the slider on the legend.
  const handleSegmentChange = (seg: number) => {
    setNumWholeSegments(seg)
  }

  const recalculatedThresholds = (() => {
    const increment = (outliers[1] - outliers[0]) / numWholeSegments
    const recalc = [];

    if (layerType === "fisheries") {
      const increment_length = Math.trunc(increment).toString().length;
      const digits_to_round = increment_length - 2

      const fixed_increment = Math.round(increment / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)
      let fixed_low_outlier = Math.round(outliers[0] / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)

      if (fixed_low_outlier <= 0) {
        fixed_low_outlier = Math.pow(10, digits_to_round)
      }

      for (let i = 0; i < numWholeSegments + 1; i++) {
        recalc.push(fixed_low_outlier + i * (fixed_increment))
      }

      return recalc;
    } else {

      for (let i = 0; i < numWholeSegments + 1; i++) {
        recalc.push(Math.round((outliers[0] + i * (increment)) * 10) / 10)
      }

      return recalc;
    }
  }) ();

  const calculatedColorList = (() => {
    const colors = []
    if (layerType == "fisheries") {
      for (let i = 0; i < recalculatedThresholds.length + 1; i++) {
        colors.push(interpolate(colorRange[0], colorRange[1], i / recalculatedThresholds.length))
      }
    } else {
      const len = recalculatedThresholds.length
      for (let i = 0; i < recalculatedThresholds.length + 1; i++) {
        if (i >= len / 2){
          colors.push(interpolate("#b5bdc9", colorRange[1], (i - Math.floor(len / 2)) / Math.ceil(len / 2)))
        } else {
          colors.push(interpolate("#b5bdc9", colorRange[0], (Math.ceil(len / 2) - i) / Math.ceil(len / 2)))
        }
      }
    }
    return colors;
  }) ()
   
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Legend 
        numericalThresholds={recalculatedThresholds}
        colorRange={colorRange}
        defaultColorRange={defaultColorRange}
        scaleColorList={calculatedColorList}
        unit={layerType == "fisheries" ? "Total Exchange Value (USD)" : "Relative change in area (%)"}
        onChangeColor={handleColorChange}
        onChangeSegment={handleSegmentChange}
        layer={layerType}
      />
      
      <MapContainer
        center={position}
        zoom={7}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <ZoomControl position="topright" />
        <GeoJSONLayer
          mapType={mapType}
          layerType={layerType}
          geoData={geoData}
          appliedFilters={appliedFilters}
          selectedArea={selectedArea}
          onCountyClick={onCountyClick}
          colorList={calculatedColorList}
          numericalThresholds={recalculatedThresholds}
        />
      </MapContainer>
    </div>
  );
}
