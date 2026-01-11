import { useState } from "react";
import { composeTitleLines, type CaptionLayoutMode } from "@/caption-engine/layout/title";
import { resolveStyles } from "@/caption-engine/render/resolveStyles";
import { ScaleToFitCaption } from "@/components/ScaleToFitCaption";

const SAMPLE_HEADLINES = [
  "AI search",
  "AI search is here",
  "As generative AI tools become favored over traditional search",
  "An astonishing 58% of users now prefer using AI assistants",
  "Understanding this shift is vital for businesses looking to stay competitive",
  "The future of search is conversational and brands need to adapt now",
  "58%",
  "This changes everything",
  "Product research has evolved dramatically in the past year",
  "Consumers trust AI recommendations more than traditional ads",
  "The data speaks for itself",
  "Here's what you need to know about this major shift",
  "Three key insights for 2025 that every brand should understand",
  "AI is transforming how we discover products and services",
  "From search to conversation, the paradigm has shifted",
  "The numbers don't lie and the trend is clear",
  "What this means for your business and future growth",
  "A paradigm shift in consumer behavior is underway",
  "Ready or not, change is coming faster than expected",
  "While 49% of users may still click on traditional blue links after reading AI-generated content, competition for these clicks is intensifying.",
];

export default function CaptionComposerLab() {
  const [containerWidth] = useState(375);
  const [mode, setMode] = useState<CaptionLayoutMode>('title');

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Caption Composer Lab</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('title')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'title' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            data-testid="button-mode-title"
          >
            Title Mode (CapCut)
          </button>
          <button
            onClick={() => setMode('paragraph')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'paragraph' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            data-testid="button-mode-paragraph"
          >
            Paragraph Mode
          </button>
        </div>
      </div>
      
      <p className="text-gray-400 mb-6">
        Mode: <span className={mode === 'title' ? 'text-cyan-400' : 'text-purple-400'}>{mode}</span> | 
        Max lines: {mode === 'title' ? 3 : 5} | 
        Container: {containerWidth}px
      </p>

      <div className="space-y-8">
        {SAMPLE_HEADLINES.map((headline, idx) => {
          const composedLines = composeTitleLines(headline, { layoutMode: mode });
          const styles = resolveStyles({
            presetId: "clean_white",
            fullScreen: false,
            headlineText: headline,
            layoutMode: mode,
            layout: { containerWidthPx: containerWidth },
          });

          return (
            <div
              key={idx}
              className="border border-gray-700 rounded-lg p-4 bg-gray-800"
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase mb-1">Raw Text</h3>
                  <p className="text-sm font-mono text-gray-300">{headline}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {headline.split(/\s+/).length} words, {headline.length} chars
                  </p>
                </div>

                <div>
                  <h3 className="text-xs text-gray-500 uppercase mb-1">
                    Composed Lines ({composedLines.length})
                  </h3>
                  <div className="text-sm font-mono">
                    {composedLines.map((line, i) => (
                      <div key={i} className={mode === 'title' ? 'text-cyan-400' : 'text-purple-400'}>
                        {i + 1}. "{line}"
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs text-gray-500 uppercase mb-1">Rendered</h3>
                  <div
                    className="relative bg-gray-950 rounded-lg p-2 flex items-center justify-center"
                    style={{ minHeight: "120px", width: `${containerWidth}px` }}
                  >
                    <ScaleToFitCaption
                      lines={styles.headlineLines}
                      panelStyle={styles.panel}
                      textStyle={styles.headline}
                      containerWidthPx={containerWidth}
                      fittedFontSizePx={styles.headlineFontSizePx}
                      didFit={styles.headlineDidFit}
                      showDebug={true}
                      fitGeometry={styles.fitGeometry}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
