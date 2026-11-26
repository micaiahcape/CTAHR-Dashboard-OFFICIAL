import { useState, useEffect } from "react";
import styles from "@/css/legend.module.css"

interface ColorThresholds {
    colors: string[],
    thresholds: number[],
    thresholdDisplays: string[],
}

interface LegendProps {
    colorBreakdowns: ColorThresholds,
    display: React.ReactNode;
    onChangeColor: (clr1: string, clr2: string) => void;
    onChangeSegment: (seg: number) => void;
    onResetLegend: () => void;
}

export default function Legend({
    colorBreakdowns,
    display,
    onChangeColor,
    onChangeSegment,
    onResetLegend,
}: LegendProps) {
    const defaultColor1 = colorBreakdowns.colors[0]
    const defaultColor2 = colorBreakdowns.colors[colorBreakdowns.colors.length - 1]
    const [color1, setColor1] = useState(defaultColor1)
    const [color2, setColor2] = useState(defaultColor2)
    const [numWholeSegments, setNumWholeSegments] = useState(colorBreakdowns.thresholds.length - 1)

    const wholeSegmentArray = numWholeSegments > 0 ? Array(numWholeSegments).fill(0) : Array(1).fill(0)

    const scaleValuesDisplay = colorBreakdowns.thresholdDisplays

    // returns a string specifying where the grid templates are at.
    const labelPositionCalc: string = (() => {
        let str = `${100 / (numWholeSegments + 1)}fr `
        for (let i = 0; i < numWholeSegments; i++) {
            const computed = `${100 / (numWholeSegments + 1)}fr `
            str += computed;
        }
        return str;
    }) ();

    useEffect(() => {
        setColor1(colorBreakdowns.colors[0])
        setColor2(colorBreakdowns.colors[colorBreakdowns.colors.length - 1])
        setNumWholeSegments(colorBreakdowns.thresholds.length - 1)
    }, [colorBreakdowns])

    const changeSegment = (val: number) => {
        setNumWholeSegments(val)
        onChangeSegment(val)
    }

    return (
        <div className={styles["legendBox"]}>
            <div className={styles["unitDisplay"]}>{display}</div>
            <div className={styles["legendHolder"]} key={colorBreakdowns.colors.toString()}> {/* force the scale to rerender */}
                <div className={styles["scaleBarHolder"]}>
                    {/* lower outlier. Make the width half of a standard segment. */}
                    <div className={styles["indivScaleBar"]} style={{ backgroundColor: defaultColor1, width: `${100 / (numWholeSegments + 1) / 2}%` }} />

                    {/* standard segments. width = 100% / (numsegments + 1) */}
                    {wholeSegmentArray.map((_, index) => (
                        <div key={index} className={styles["indivScaleBar"]} style={{ backgroundColor: colorBreakdowns.colors[index+1], width: `${100 / (numWholeSegments + 1)}%` }} />
                    ))}

                    {/* upper outlier. Make the width half of a standard segment. */}
                    <div className={styles["indivScaleBar"]} style={{ backgroundColor: defaultColor2, width: `${100 / (numWholeSegments + 1) / 2}%` }} />
                    
                </div>

                <div className={styles["scaleLabelHolder"]} style={{display: "grid", gridTemplateColumns: labelPositionCalc}}>
                    {scaleValuesDisplay.map((item: string, index: number) => 
                        <p className={styles["indivScaleText"]} key={index} style={{ gridColumnStart: index + 1 }}>{item}</p>
                    )}
                </div>
            </div>
            
            <div className={styles["segmentMenu"]}>
                <label htmlFor="numSegments" className={styles["legendLabel"]}># colors: {numWholeSegments+2}</label>
                <input type="range" name="numSegments" min={3} max={8} value={numWholeSegments+2} onChange={(e) => changeSegment(Number(e.target.value) - 2)} className={styles["legendSlider"]} />
            </div>
            

            <div className={styles["editMenu"]}>
                <div className={styles["labelHolder"]}>
                    <label htmlFor="lowColor" className={styles["legendLabel"]}>Gradients&nbsp;</label>
                    <input type="color" name="lowColor" value={color1} onChange={(e) => setColor1(e.target.value)} className={styles["colorInput"]}/>
                    <input type="color" name="hiColor" value={color2} onChange={(e) => setColor2(e.target.value)} className={styles["colorInput"]}/>
                </div>

                <button onClick={() => onResetLegend()} className={styles["submitBtn"]}>Reset</button>
                
                <button onClick={() => onChangeColor(color1, color2)} className={styles["submitBtn"]}>OK</button>
                
            </div>
        </div>
    )
}