import { extractMenuItemsMultiPage, MultiPageMenuItem, validateExtractionQuality } from '../services/catalogueDetection';

interface SmokeTestResult {
  url: string;
  success: boolean;
  itemCount: number;
  pagesVisited: number;
  qualityScore: number;
  qualityPassed: boolean;
  durationMs: number;
  schemaItemsCount: number;
  domItemsCount: number;
  error?: string;
}

const TEST_URLS = [
  'https://www.kfc.co.uk/menu',
  'https://www.pizzahut.co.uk/restaurants/menu/',
  'https://www.burgerking.co.uk/menu',
  'https://www.subway.com/en-gb/menunutrition/menu',
];

async function runSmokeTest(url: string): Promise<SmokeTestResult> {
  const start = Date.now();
  
  try {
    console.log(`\n[Smoke] Testing: ${url}`);
    const items = await extractMenuItemsMultiPage(url, 8);
    const duration = Date.now() - start;
    
    const quality = validateExtractionQuality(items, 5);
    
    const schemaItems = items.filter(i => i.sourceUrl !== url).length;
    
    return {
      url,
      success: true,
      itemCount: items.length,
      pagesVisited: new Set(items.map(i => i.sourceUrl)).size,
      qualityScore: quality.score,
      qualityPassed: quality.passed,
      durationMs: duration,
      schemaItemsCount: schemaItems,
      domItemsCount: items.length - schemaItems,
    };
  } catch (err) {
    return {
      url,
      success: false,
      itemCount: 0,
      pagesVisited: 0,
      qualityScore: 0,
      qualityPassed: false,
      durationMs: Date.now() - start,
      schemaItemsCount: 0,
      domItemsCount: 0,
      error: (err as Error).message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  EXTRACTION SMOKE TEST');
  console.log('='.repeat(60));
  
  const results: SmokeTestResult[] = [];
  
  for (const url of TEST_URLS) {
    const result = await runSmokeTest(url);
    results.push(result);
    
    console.log(`\n  ${result.success ? '✓' : '✗'} ${url}`);
    console.log(`    Items: ${result.itemCount}, Pages: ${result.pagesVisited}`);
    console.log(`    Quality: ${result.qualityScore}/100 (${result.qualityPassed ? 'PASS' : 'FAIL'})`);
    console.log(`    Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    if (result.error) console.log(`    Error: ${result.error}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success && r.qualityPassed).length;
  const total = results.length;
  const avgItems = results.reduce((s, r) => s + r.itemCount, 0) / total;
  const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / total;
  
  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Avg Items: ${avgItems.toFixed(1)}`);
  console.log(`  Avg Duration: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log('='.repeat(60));
  
  process.exit(passed === total ? 0 : 1);
}

main().catch(console.error);
