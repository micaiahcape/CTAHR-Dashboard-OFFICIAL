"use client";

import dynamic from "next/dynamic";
const MultiRangeSlider = dynamic(() => {
    import("multi-range-slider-react/lib/multirangesliderblack.css")

    import("multi-range-slider-react")
}, { ssr: false });


export default function SafeMultiRangeSlider({...props}: any) {
    return <MultiRangeSlider {...props} />;
}