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
  layerType: LayerType;
  geoData: DashboardGeoJSON;
  appliedFilters: FisheryFilterSettings
  onCountyClick: (county: string) => void;
  outliers: [number, number]; // an array containing two numbers: the 5th and 95th percentiles. Any number that falls on either side of that extreme will default to the color on that end. Otherwise, the color will be calculated by linear interpolation.
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

  return `rgb(${rFinal}, ${gFinal}, ${bFinal})`;
}

function GeoJSONLayer({
  mapType,
  layerType,
  geoData,
  appliedFilters,
  colorList,
  numericalThresholds,
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
        const featureKey = isExtents
          ? feature?.properties?.moku_key
          : feature?.properties?.name
        const isSelected = appliedFilters.county !== "" && featureKey === appliedFilters.county;
        return {
          fillColor: getColor(value),
          fillOpacity: isSelected ? 0.65 : 0.9,
          color: isSelected ? "#d94801" : "#222",
          weight: isSelected ? 2.5 : 0.8,
        };
      },
      onEachFeature: (feature, layer) => {
        const value = Number(feature?.properties?.[field]) || 0;

        const label = isExtents
          ? `${feature.properties.moku} — ${feature.properties.island}`
          : feature.properties.name
        
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

        const tooltipContent = `
          <div style="font-size: 13px">
            <strong>${label}</strong><br/>
            ${isExtents ? (
              `${feature.properties.year1} area: ${feature.properties.year1Value} km<sup>2</sup> <br/>
              <div style="display: flex">
                <p style="margin: auto 6px auto 0;">${feature.properties.year2} area: ${feature.properties.year2Value} km<sup>2</sup></p>
                <b style="background-color: ${getColor(value)}; padding: 1px 2px; font-size: 15px">${formattedValue}</b>
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
            const key = isExtents
              ? feature.properties.moku_key
              : feature.properties.name
            onCountyClick?.(String(key ?? ""));
          },
          mouseover: (e: L.LeafletMouseEvent) => {
            e.target.setStyle({ fillOpacity: 0.65 });
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            const featureKey = isExtents
              ? feature.properties.moku_key
              : feature.properties.name
            const isSel = appliedFilters.county !== "" && featureKey === appliedFilters.county;
            e.target.setStyle({ fillOpacity: isSel ? 0.65 : 0.9 });
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
  }, [geoData, layerType, mapType, appliedFilters, getColor, onCountyClick, map]);

  return null;
}

export default function Map({
  mapType,
  layerType,
  geoData,
  appliedFilters,
  outliers,
  onCountyClick,
}: MapProps) {
  const position: LatLngExpression = [20.5, -157.5];

  const [numWholeSegments, setNumWholeSegments] = useState<number>(layerType == "fisheries" ? 2 : 4)
  const [colorRange, setColorRange] = useState<[string, string]>(layerType == "fisheries" ? ["#FFFFFF", "#ff3300"] : ["#0362fc", "#fc0345"])

  useEffect(() => {
    if (layerType === "extents") {
      setColorRange(["#0362fc", "#fc0345"])
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
        defaultColorRange={colorRange}
        scaleColorList={calculatedColorList}
        unit="Total Exchange Value (USD)"
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
          onCountyClick={onCountyClick}
          colorList={calculatedColorList}
          numericalThresholds={recalculatedThresholds}
        />
      </MapContainer>
    </div>
  );
}
