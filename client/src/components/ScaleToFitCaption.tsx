import React from "react";
import type { CSSProperties } from "react";

interface FitGeometry {
  panelWidthPx: number;
  paddingPx: number;
  panelMaxWidthPercent: number;
}

interface ScaleToFitCaptionProps {
  lines: string[];
  panelStyle: CSSProperties;
  textStyle: CSSProperties;
  containerWidthPx: number;
  fittedFontSizePx: number;
  didFit?: boolean;
  showDebug?: boolean;
  fitGeometry?: FitGeometry;
}

export function ScaleToFitCaption({
  lines,
  panelStyle,
  textStyle,
  containerWidthPx,
  fittedFontSizePx,
  didFit = true,
  showDebug = false,
  fitGeometry,
}: ScaleToFitCaptionProps) {
  // Use EXACT values from fit engine if provided, otherwise use matching defaults
  const padding = fitGeometry?.paddingPx ?? 16;
  const panelMaxWidthPercent = fitGeometry?.panelMaxWidthPercent ?? 92;
  const panelWidthPx = fitGeometry?.panelWidthPx ?? (containerWidthPx * panelMaxWidthPercent / 100);
  
  // Apply same 8% safety margin as fit engine
  const safetyMargin = 0.08;
  const innerWidth = (panelWidthPx - (padding * 2)) * (1 - safetyMargin);

  const lineStyle: CSSProperties = {
    ...textStyle,
    fontSize: `${fittedFontSizePx}px`,
    whiteSpace: "nowrap",
    margin: 0,
    display: "block",
    textAlign: "center",
  };

  return (
    <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
      {/* Panel: exact width from fit engine, centered */}
      <div
        style={{
          ...panelStyle,
          width: `${panelWidthPx}px`,
          padding: `${padding}px`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        data-testid="caption-panel"
      >
        {/* Text container: exact inner width matching fit engine */}
        <div
          style={{
            width: `${innerWidth}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.15,
          }}
          data-testid="text-headline"
        >
          {lines.map((line, i) => (
            <div key={i} style={lineStyle}>
              {line}
            </div>
          ))}
        </div>
      </div>
      {showDebug && (
        <div
          style={{
            position: "absolute",
            bottom: "-24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: didFit ? "rgba(0,200,0,0.9)" : "rgba(255,100,0,0.9)",
            color: "white",
            fontSize: "10px",
            fontFamily: "monospace",
            padding: "2px 6px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
          }}
        >
          {didFit ? "✓" : "✗"} {fittedFontSizePx}px | {lines.length}L | p{padding} inner:{Math.round(innerWidth)}w
        </div>
      )}
    </div>
  );
}
