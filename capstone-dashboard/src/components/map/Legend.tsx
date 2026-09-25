/*
Scale component. Takes:
1) an array of [min, max] values
2) an array of 2 colors to represent min, max values
3) the number of segments to divide the scale into (not including outliers)
*/
import { text } from "stream/consumers";
import "./legend.css"

interface LegendProps {
    numericalThresholds: any;
    colorRange: [string, string];
    numWholeSegments: number;
    unit: string;
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
    numWholeSegments,
    unit
}: LegendProps) {

    const wholeSegmentArray = Array(numWholeSegments).fill(0)
    const scaleValuesArray = Array(numWholeSegments+1).fill(0)
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

                <div className="scaleLabelHolder">
                    {scaleValuesArray.map((_, index) => {
                        const computedLeft = `${(100 / (numWholeSegments + 1) / 2) + (index * (100 / (numWholeSegments + 1)))}%`
                        const computedValue = numericalThresholds[0] + (index / numWholeSegments) * (numericalThresholds[1] - numericalThresholds[0])
                        return (
                            <p className="indivScaleText" style={{ left: computedLeft }}>{computedValue}</p>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}