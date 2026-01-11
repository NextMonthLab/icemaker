/**
 * Caption Debug Overlay
 *
 * Visual overlay for debugging caption geometry and verifying no clipping occurs.
 * Shows safe area boundaries, caption region, and available text area.
 *
 * Usage: Add to CardPlayer with a debug toggle (e.g., press 'D' key)
 */

import React from "react";
import type { CaptionGeometry } from "@/caption-engine/geometry";
import { getDebugOverlayData } from "@/caption-engine/geometry";

interface CaptionDebugOverlayProps {
  geometry: CaptionGeometry;
  enabled: boolean;
}

export function CaptionDebugOverlay({
  geometry,
  enabled,
}: CaptionDebugOverlayProps) {
  if (!enabled) return null;

  const debug = getDebugOverlayData(geometry);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-50"
      style={{ overflow: "hidden" }}
    >
      {/* Safe area boundaries */}
      <div
        className="absolute border-2 border-green-500 border-dashed"
        style={{
          left: `${debug.safeAreaBounds.left}px`,
          right: `${debug.safeAreaBounds.right}px`,
          top: `${debug.safeAreaBounds.top}px`,
          bottom: `${debug.safeAreaBounds.bottom}px`,
        }}
      />

      {/* Caption available region */}
      <div
        className="absolute border-2 border-yellow-500"
        style={{
          left: `${debug.captionRegion.left}px`,
          bottom: `${debug.captionRegion.bottom}px`,
          width: `${debug.captionRegion.width}px`,
          height: "4px",
          backgroundColor: "rgba(255, 255, 0, 0.5)",
        }}
      />

      {/* Caption region vertical line markers */}
      <div
        className="absolute border-l-2 border-yellow-500"
        style={{
          left: `${debug.captionRegion.left}px`,
          bottom: `${debug.captionRegion.bottom}px`,
          height: "200px",
        }}
      />
      <div
        className="absolute border-r-2 border-yellow-500"
        style={{
          left: `${debug.captionRegion.left + debug.captionRegion.width}px`,
          bottom: `${debug.captionRegion.bottom}px`,
          height: "200px",
        }}
      />

      {/* Debug info panel */}
      <div
        className="absolute top-4 right-4 bg-black/80 text-white text-xs p-3 rounded font-mono pointer-events-auto"
        style={{ maxWidth: "250px" }}
      >
        <div className="font-bold mb-2 text-green-400">
          Caption Geometry Debug
        </div>
        <div className="space-y-1">
          <div>
            <span className="text-gray-400">Composition:</span>{" "}
            {debug.composition.width}x{debug.composition.height}
          </div>
          <div>
            <span className="text-gray-400">Safe Area:</span>
          </div>
          <div className="pl-2">
            L: {Math.round(debug.safeAreaBounds.left)}px, R:{" "}
            {Math.round(debug.safeAreaBounds.right)}px
          </div>
          <div className="pl-2">
            T: {Math.round(debug.safeAreaBounds.top)}px, B:{" "}
            {Math.round(debug.safeAreaBounds.bottom)}px
          </div>
          <div>
            <span className="text-gray-400">Caption Width:</span>
          </div>
          <div className="pl-2">
            {Math.round(debug.captionRegion.width)}px (viewport)
          </div>
          <div className="pl-2">
            {Math.round(geometry.availableCaptionWidth)}px (composition)
          </div>
          <div>
            <span className="text-gray-400">Scale:</span>{" "}
            {geometry.viewportScale.toFixed(2)}x
          </div>
          <div className="mt-2 pt-2 border-t border-gray-600">
            <span className="text-green-500">■</span> Safe Area
            <br />
            <span className="text-yellow-500">■</span> Caption Region
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Caption Torture Test Component
 *
 * Renders worst-case caption scenarios for regression testing.
 * Use in development to verify no clipping occurs.
 */

interface TortureTestCaption {
  id: string;
  text: string;
  description: string;
}

const TORTURE_TEST_CAPTIONS: TortureTestCaption[] = [
  {
    id: "long-no-spaces",
    text: "Thisisaverylongcaptionwithoutanyspacesthatcouldpotentiallycauseoverflowissues",
    description: "Long text without spaces",
  },
  {
    id: "numbers-symbols",
    text: "1234567890!@#$%^&*()_+-=[]{}|;:',.<>?/~`",
    description: "Numbers and symbols",
  },
  {
    id: "very-long-sentence",
    text: "This is an extremely long sentence that goes on and on and on without stopping and it's designed to test the maximum length handling of the caption system to ensure nothing clips or breaks",
    description: "Very long sentence",
  },
  {
    id: "mixed-case-caps",
    text: "COMPLETELY UPPERCASE TEXT THAT IS QUITE LONG AND MIGHT RENDER WIDER THAN LOWERCASE",
    description: "All caps (wider glyphs)",
  },
  {
    id: "unicode-emojis",
    text: "Testing with emojis 🚀🎉🔥💯 and unicode characters: 你好世界 مرحبا",
    description: "Unicode and emojis",
  },
  {
    id: "repeating-wide-chars",
    text: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    description: "Repeating wide characters",
  },
  {
    id: "single-word-long",
    text: "Supercalifragilisticexpialidociousandthensomeextracharacterstomakeit even longer",
    description: "Single super long word",
  },
  {
    id: "normal-length",
    text: "This is a normal length caption that should fit easily",
    description: "Normal baseline caption",
  },
  {
    id: "hyphenated-words",
    text: "Using-lots-of-hyphenated-words-to-test-line-breaking-and-word-wrapping-behavior-in-captions",
    description: "Hyphenated words",
  },
  {
    id: "percentage-clipping",
    text: "AI search is transforming online discovery affecting 58% of users worldwide",
    description: "Real-world example (reported bug)",
  },
];

interface CaptionTortureTestProps {
  geometry: CaptionGeometry;
  renderCaption: (text: string) => React.ReactNode;
}

export function CaptionTortureTest({
  geometry,
  renderCaption,
}: CaptionTortureTestProps) {
  return (
    <div className="bg-gray-900 text-white p-8 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Caption Torture Test</h1>

      <div className="mb-6 p-4 bg-gray-800 rounded">
        <h2 className="font-bold mb-2">Geometry Info</h2>
        <div className="text-sm space-y-1">
          <div>
            Composition: {geometry.compositionWidth}x
            {geometry.compositionHeight}
          </div>
          <div>
            Available Caption Width: {Math.round(geometry.availableCaptionWidth)}
            px
          </div>
          <div>Viewport Scale: {geometry.viewportScale}x</div>
          <div>
            Viewport Caption Width:{" "}
            {Math.round(geometry.viewportCaptionWidth)}px
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {TORTURE_TEST_CAPTIONS.map((test) => (
          <div key={test.id} className="border border-gray-700 rounded p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-sm text-yellow-400">
                {test.description}
              </h3>
              <span className="text-xs text-gray-500">{test.text.length} chars</span>
            </div>

            <div className="bg-gray-800 p-4 rounded mb-2">
              <code className="text-xs text-gray-400 break-all">
                {test.text}
              </code>
            </div>

            <div
              className="relative bg-black rounded overflow-hidden aspect-[9/16] max-w-sm"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, #1a1a2e, #16213e, #0f3460)",
              }}
            >
              <CaptionDebugOverlay geometry={geometry} enabled={true} />
              <div className="absolute inset-0 flex items-end justify-center">
                {renderCaption(test.text)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CaptionDebugOverlay;
