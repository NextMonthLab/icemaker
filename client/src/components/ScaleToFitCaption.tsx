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
  const paddingPx = fitGeometry?.paddingPx ?? 16;

  const lineStyle: CSSProperties = {
    ...textStyle,
    fontSize: `${fittedFontSizePx}px`,
    whiteSpace: "normal", // Allow word wrapping to prevent overflow
    wordWrap: "break-word",
    overflowWrap: "break-word",
    margin: 0,
    display: "block",
    textAlign: "center",
  };

  return (
    <div style={{ 
      position: "relative", 
      width: "100%", 
      display: "flex", 
      justifyContent: "center" 
    }}>
      {/* Bubble: 100% of parent width (parent is already capped at 90%) */}
      <div
        style={{
          ...panelStyle,
          width: "100%",
          maxWidth: "100%",
          paddingLeft: paddingPx,
          paddingRight: paddingPx,
          paddingTop: paddingPx,
          paddingBottom: paddingPx,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
          marginRight: "auto",
          overflow: "hidden", // Prevent text from overflowing container bounds
        }}
        data-testid="caption-panel"
      >
        {/* Text wrapper: 100% fills remaining space after padding = panelWidthPx - 2*paddingPx */}
        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
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
          {didFit ? "✓" : "✗"} {fittedFontSizePx}px | {lines.length}L | pad:{paddingPx}
        </div>
      )}
    </div>
  );
}
