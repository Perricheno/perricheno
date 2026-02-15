"use client";

import Grainient from "./Grainient";

export default function Background() {
    return (
        <div className="fixed inset-0 -z-10 pointer-events-none">
            <Grainient
                color1="#242424"
                color2="#8c8c8c"
                color3="#141414"
                timeSpeed={0.75}
                colorBalance={0}
                warpStrength={3.45}
                warpFrequency={5}
                warpSpeed={0.9}
                warpAmplitude={79}
                blendAngle={0}
                blendSoftness={0.05}
                rotationAmount={500}
                noiseScale={2}
                grainAmount={0.1}
                grainScale={2}
                grainAnimated={false}
                contrast={1.5}
                gamma={1.3}
                saturation={0.9}
                centerX={0}
                centerY={0}
                zoom={0.9}
            />
        </div>
    );
}
