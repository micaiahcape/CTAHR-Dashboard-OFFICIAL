/*
Scale component. Takes:
1) an array of [min, max] values
2) an array of 2 colors to represent min, max values
3) the number of segments to divide the scale into (not including outliers)
*/
import { text } from "stream/consumers";
import { useState, useEffect } from "react";
import "./legend.css"

interface LegendProps {
    numericalThresholds: number[];
    colorRange: [string, string];
    unit: string;
    onSendClrData: (clr: string, id: number) => void;
    onSendSegmentData: (clr: number) => void;
}

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

export default function Legend({
    numericalThresholds, 
    colorRange, 
    unit,
    onSendClrData,
    onSendSegmentData
}: LegendProps) {

    const color1 = colorRange[0]
    const color2 = colorRange[1]
    const numWholeSegments = numericalThresholds.length - 1

    const wholeSegmentArray = numWholeSegments > 0 ? Array(numWholeSegments).fill(0) : Array(1).fill(0)
    
    const scaleValuesDisplay = (() => {
        const finalValue = numericalThresholds[numWholeSegments]
        const finalUnit = (finalValue > 1000000 ? "M" : "K")

        const fixedScaleValues: string[] = numericalThresholds.map((item: number): string => {
            if (item < 100000 || (item < 1000000 && finalUnit == "K")) {
                return (item / 1000) + "K"
            } else if (item > 100000 || (item < 1000000 && finalUnit == "M")) {
                return (item / 1000000) + "M"
            }
            return ""
        })

        return fixedScaleValues;
    }) ();

    return (
        <div className="legendBox">
            <div className="editMenu">
                <label htmlFor="lowColor">Color 1&nbsp;</label>
                <input type="color" name="lowColor" value={color1} onChange={(e) => onSendClrData(e.target.value, 0)}/>
                <br />
                <label htmlFor="hiColor">Color 2&nbsp;</label>
                <input type="color" name="hiColor" value={color2} onChange={(e) => onSendClrData(e.target.value, 1)}/>
                <br />
                <label htmlFor="numSegments"># colors: {numWholeSegments+2}</label>
                <input type="range" name="numSegments" min={3} max={8} value={numWholeSegments+2} onChange={(e) => onSendSegmentData(Number(e.target.value) - 2)}/>
            </div>

            <p className="unitDisplay">{unit}</p>
            <div className="legendHolder">
                <div className="scaleBarHolder">
                    {/* lower outlier. Make the width half of a standard segment. */}
                    <div className="indivScaleBar" style={{ backgroundColor: color1, width: `${100 / (numWholeSegments + 1) / 2}%` }} />

                    {/* standard segments. width = 100% / (numsegments + 1) */}
                    {wholeSegmentArray.map((_, index) => (
                        <div key={index} className="indivScaleBar" style={{ backgroundColor: interpolate(color1, color2, (index + 1) / (numWholeSegments + 1)), width: `${100 / (numWholeSegments + 1)}%` }} />
                    ))}

                    {/* upper outlier. Make the width half of a standard segment. */}
                    <div className="indivScaleBar" style={{ backgroundColor: color2, width: `${100 / (numWholeSegments + 1) / 2}%` }} />
                    
                </div>

                <div className="scaleLabelHolder">
                    {scaleValuesDisplay.map((item: string, index: number) => {
                        const computedLeft = `${(100 / (numWholeSegments + 1) / 2) + (index * (100 / (numWholeSegments + 1)))}%`
                        return (
                            <p className="indivScaleText" style={{ left: computedLeft }}>{item}</p>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}