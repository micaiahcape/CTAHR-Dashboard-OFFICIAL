/*
 * Leaflet map component. Renders a choropleth layer over Hawaii using GeoJSON
 * data for either the fisheries or ecosystem extents layer. Colors are assigned
 * via a quintile scale (stable thresholds passed from the parent so colors don't
 * shift when filters change). Tooltips show region name, value, and active
 * filter context. Clicking a region fires onCountyClick to open the viz panel.
 */
"use client";

import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { GeoJsonObject } from "geojson";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const Legend = dynamic(() => import("../map/Legend"), { ssr: false });

type LayerType = "fisheries" | "extents";
type FeatureValueField = "total_area_km2" | "total_exchange_value";

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

/*interface ColorThresholds {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}*/

interface MapProps {
  mapType?: string;
  layerType?: LayerType;
  geoData: DashboardGeoJSON;
  selectedCounty: string;
  selectedYearStart: number | null;
  selectedYearEnd: number | null;
  selectedSpecies: string;
  selectedEcosystem: string;
  onCountyClick?: (county: string) => void;
  colorRange: [string, string];
  outliers: [number, number]; // an array containing two numbers: the 5th and 95th percentiles. Any number that falls on either side of that extreme will default to the color on that end. Otherwise, the color will be calculated by linear interpolation.
  numericalThresholds: any;
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
  selectedCounty,
  selectedYearStart,
  selectedYearEnd,
  selectedSpecies,
  selectedEcosystem,
  colorRange,
  numericalThresholds,
  onCountyClick,
}: Omit<MapProps, "layerType" | "outliers"> & { layerType: LayerType }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  const getColor = (value: number) => {
    let index = 0;
    while (value > numericalThresholds[index] && index < numericalThresholds.length) {
      index++;
    }
    return interpolate(colorRange[0], colorRange[1], index / numericalThresholds.length)
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

    const field: FeatureValueField = layerType === "extents" ? "total_area_km2" : "total_exchange_value";
    const isExtents = layerType === "extents";

    const geojsonLayer = L.geoJSON(geoData as GeoJsonObject, {
      style: (feature) => {
        const value = Number(feature?.properties?.[field]) || 0;
        const featureKey = isExtents
          ? feature?.properties?.moku_key
          : mapType === "comm"
          ? feature?.properties?.area_id
          : feature?.properties?.county;
        const isSelected = selectedCounty !== "" && featureKey === selectedCounty;
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
          ? `${feature.properties.realm} — ${feature.properties.moku_olelo}`
          : mapType === "comm"
          ? `${feature.properties.area_id}`
          : `County: ${feature.properties.county}`;

        const valueLine = isExtents
          ? `Area: ${value.toFixed(2)} km²`
          : `Exchange Value: ${formatCurrency(value)}`;

        const tooltipContent = `
          <div style="font-size:13px">
            <strong>${label}</strong><br/>
            ${valueLine}<br/>
            ${isExtents
              ? `Ecosystem: ${selectedEcosystem || "All"}`
              : `Year: ${selectedYearStart || selectedYearEnd
                  ? `${selectedYearStart ?? "start"} – ${selectedYearEnd ?? "end"}`
                  : "All Years"
                }<br/>
                 Species: ${selectedSpecies || "All"}<br/>
                 Ecosystem: ${selectedEcosystem || "All"}`
            }
          </div>
        `;

        layer.bindTooltip(tooltipContent, { sticky: true });

        layer.on({
          click: () => {
            const key = isExtents
              ? feature.properties.moku_key
              : mapType === "comm"
              ? feature.properties.area_id
              : feature.properties.county;
            onCountyClick?.(String(key ?? ""));
          },
          mouseover: (e: L.LeafletMouseEvent) => {
            e.target.setStyle({ fillOpacity: 0.65 });
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            const featureKey = isExtents
              ? feature.properties.moku_key
              : mapType === "comm"
              ? feature.properties.area_id
              : feature.properties.county;
            const isSel = selectedCounty !== "" && featureKey === selectedCounty;
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
  }, [geoData, layerType, mapType, selectedCounty, selectedYearStart, selectedYearEnd, selectedSpecies, selectedEcosystem, getColor, onCountyClick, map]);

  return null;
}

export default function Map({
  mapType,
  layerType = "fisheries",
  geoData,
  selectedCounty,
  selectedYearStart,
  selectedYearEnd,
  selectedSpecies,
  selectedEcosystem,
  outliers,
  onCountyClick,
}: MapProps) {
  const position: LatLngExpression = [20.5, -157.5];

  const numWholeSegments =2;
  const colorRange: [string, string] = ["#ddff00", "#ff2f00"]

  const recalculatedThresholds = (() => {
    const increment = (outliers[1] - outliers[0]) / numWholeSegments
    const increment_length = Math.trunc(increment).toString().length;
    const digits_to_round = increment_length - 2

    const fixed_increment = Math.round(increment / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)
    let fixed_low_outlier = Math.round(outliers[0] / Math.pow(10, digits_to_round)) * Math.pow(10, digits_to_round)

    if (fixed_low_outlier <= 0) {
      fixed_low_outlier = Math.pow(10, digits_to_round)
    }
    const recalc = [];

    for (let i = 0; i < numWholeSegments + 1; i++) {
      recalc.push(fixed_low_outlier + i * (fixed_increment))
    }
    return recalc;

  }) ();
  
  return (
    <div style={{ width: "100%", height: "100%" }}>

      <Legend 
        numericalThresholds={recalculatedThresholds}
        colorRange={colorRange}
        unit="Total Exchange Value (USD)"
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
          selectedCounty={selectedCounty}
          selectedYearStart={selectedYearStart}
          selectedYearEnd={selectedYearEnd}
          selectedSpecies={selectedSpecies}
          selectedEcosystem={selectedEcosystem}
          onCountyClick={onCountyClick}
          colorRange={colorRange}
          numericalThresholds={recalculatedThresholds}
        />
      </MapContainer>
    </div>
  );
}
