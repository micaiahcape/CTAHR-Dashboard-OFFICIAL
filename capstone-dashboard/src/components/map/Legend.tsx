/*
Scale component. Takes:
1) an array of [min, max] values
2) an array of 2 colors to represent min, max values
3) the number of segments to divide the scale into (not including outliers)
*/
import { text } from "stream/consumers";
import React, { useState, useEffect } from "react";
import "./legend.css"

interface LegendProps {
    numericalThresholds: number[];
    colorRange: [string, string];
    defaultColorRange: [string, string];
    unit: string;
    onChangeColor: (clr1: string, clr2: string) => void;
    onChangeSegment: (seg: number) => void;
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
    defaultColorRange,
    unit,
    onChangeColor,
    onChangeSegment,
}: LegendProps) {

    const [color1, setColor1] = React.useState(colorRange[0])
    const [color2, setColor2] = React.useState(colorRange[1])
    const [numWholeSegments, setNumWholeSegments] = React.useState(numericalThresholds.length - 1)

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

    // returns a string specifying where the grid templates are at.
    const labelPositionCalc: string = (() => {
        let str = `${100 / (numWholeSegments + 1) / 2}fr `
        for (let i = 0; i < numWholeSegments; i++) {
            const computed = `${100 / (numWholeSegments + 1)}fr `
            str += computed;
        }
        str += `${100 / (numWholeSegments + 1) / 2}fr `
        console.log(str)
        return str;
    }) ();

    const changeSegment = (val: number) => {
        setNumWholeSegments(val)
        onChangeSegment(val)
    }

    return (
        <div className="legendBox">
            <p className="unitDisplay">{unit}</p>
            <div className="legendHolder">
                <div className="scaleBarHolder">
                    {/* lower outlier. Make the width half of a standard segment. */}
                    <div className="indivScaleBar" style={{ backgroundColor: colorRange[0], width: `${100 / (numWholeSegments + 1) / 2}%` }} />

                    {/* standard segments. width = 100% / (numsegments + 1) */}
                    {wholeSegmentArray.map((_, index) => (
                        <div key={index} className="indivScaleBar" style={{ backgroundColor: interpolate(colorRange[0], colorRange[1], (index + 1) / (numWholeSegments + 1)), width: `${100 / (numWholeSegments + 1)}%` }} />
                    ))}

                    {/* upper outlier. Make the width half of a standard segment. */}
                    <div className="indivScaleBar" style={{ backgroundColor: colorRange[1], width: `${100 / (numWholeSegments + 1) / 2}%` }} />
                    
                </div>

                <div className="scaleLabelHolder" style={{display: "grid", gridTemplateColumns: labelPositionCalc}}>
                    {scaleValuesDisplay.map((item: string, index: number) => 
                        <p className="indivScaleText" key={index} style={{ gridColumnStart: index + 1 }}>{item}</p>
                    )}
                </div>
            </div>
            
            <div className="segmentMenu">
                <label htmlFor="numSegments" className="legendLabel"># colors: {numWholeSegments+2}</label>
                <input type="range" name="numSegments" min={3} max={8} value={numWholeSegments+2} onChange={(e) => changeSegment(Number(e.target.value) - 2)} className="legendSlider" />
            </div>
            

            <div className="editMenu">
                <div className="labelHolder">
                    <label htmlFor="lowColor" className="legendLabel">Gradients&nbsp;</label>
                    <input type="color" name="lowColor" value={color1} onChange={(e) => setColor1(e.target.value)} className="colorInput"/>
                    <input type="color" name="hiColor" value={color2} onChange={(e) => setColor2(e.target.value)} className="colorInput"/>
                </div>

                <button onClick={() => {
                    onChangeColor(defaultColorRange[0], defaultColorRange[1])
                    setColor1(defaultColorRange[0])
                    setColor2(defaultColorRange[1])
                    }} className="submitBtn">Reset</button>
                
                <button onClick={() => onChangeColor(color1, color2)} className="submitBtn">OK</button>
                
            </div>
        </div>
    )
}