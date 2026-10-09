/*
 * Entry point page. Mounts the EcosystemDashboard with the marine counties
 * GeoJSON path and the "Fisheries" dataset label as initial props.
 */
'use client';
import EcosystemDashboard from "@/components/dashboard/EcosystemDashboard";

export default function Home() {
  return (
    <EcosystemDashboard
      geoJsonPath="/fisheriesdata/marinecounties.geojson"
      datasetLabel="Fisheries"
    />
  );
}
