import { useState } from "react";
import { useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2, Package, Trash2, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import OrbitLayout from "@/components/OrbitLayout";
import { UrlIngestForm, TileRow, TileDrawer, TileDrawerOverlay } from "@/components/orbit-tiles";
import type { OrbitTile, OrbitCrawlReport } from "../../../../shared/orbitTileTypes";

interface ImportItem {
  title: string;
  description?: string;
  price?: string | number;
  currency?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
  image_url?: string;
  tags?: { key: string; value: string; label?: string }[];
  sku?: string;
  availability?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  validationErrors: number;
  errors?: { index: number; error: string }[];
}

interface IngestResponse {
  success: boolean;
  orbitId: string;
  tiles: OrbitTile[];
  crawlReport: OrbitCrawlReport;
  cached?: boolean;
  message?: string;
}

interface GroupedTiles {
  'Top Insights': OrbitTile[];
  'Services & Offers': OrbitTile[];
  'FAQs & Objections': OrbitTile[];
  'Proof & Trust': OrbitTile[];
  'Recommendations': OrbitTile[];
}

function groupTilesByCategory(tiles: OrbitTile[]): GroupedTiles {
  const groups: GroupedTiles = {
    'Top Insights': [],
    'Services & Offers': [],
    'FAQs & Objections': [],
    'Proof & Trust': [],
    'Recommendations': [],
  };
  
  for (const tile of tiles) {
    if (groups[tile.category as keyof GroupedTiles]) {
      groups[tile.category as keyof GroupedTiles].push(tile);
    } else {
      groups['Top Insights'].push(tile);
    }
  }
  
  return groups;
}

export default function CatalogueImport() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  
  // Manual import state
  const [jsonInput, setJsonInput] = useState("");
  const [parsedItems, setParsedItems] = useState<ImportItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [boxType, setBoxType] = useState<'product' | 'menu_item'>('product');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Website Intelligence state
  const [tiles, setTiles] = useState<OrbitTile[]>([]);
  const [crawlReport, setCrawlReport] = useState<OrbitCrawlReport | null>(null);
  const [selectedTile, setSelectedTile] = useState<OrbitTile | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  
  const ingestMutation = useMutation({
    mutationFn: async ({ url, forceRescan }: { url: string; forceRescan?: boolean }) => {
      const response = await fetch(`/api/orbit/${slug}/ingest-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url, forceRescan }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to ingest URL');
      }
      
      return response.json() as Promise<IngestResponse>;
    },
    onSuccess: (data) => {
      setTiles(data.tiles);
      setCrawlReport(data.crawlReport);
      setResultMessage(data.message || null);
      toast({
        title: "Website scanned",
        description: `Generated ${data.tiles.length} topic tiles`,
      });
    },
  });
  
  const handleUrlIngest = async (url: string, forceRescan?: boolean) => {
    setLastUrl(url);
    setResultMessage(null);
    await ingestMutation.mutateAsync({ url, forceRescan });
  };
  
  const groupedTiles = groupTilesByCategory(tiles);
  const tileRows = [
    { title: 'Top Insights', tiles: groupedTiles['Top Insights'] },
    { title: 'Services & Offers', tiles: groupedTiles['Services & Offers'] },
    { title: 'FAQs & Objections', tiles: groupedTiles['FAQs & Objections'] },
    { title: 'Proof & Trust', tiles: groupedTiles['Proof & Trust'] },
    { title: 'Recommendations', tiles: groupedTiles['Recommendations'] },
  ].filter(row => row.tiles.length > 0);

  const parseJson = (input: string) => {
    setParseError(null);
    setParsedItems([]);
    
    if (!input.trim()) {
      return;
    }
    
    try {
      const parsed = JSON.parse(input);
      
      let items: ImportItem[] = [];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else if (parsed.products && Array.isArray(parsed.products)) {
        items = parsed.products;
      } else if (parsed.menu && Array.isArray(parsed.menu)) {
        items = parsed.menu;
      } else {
        items = [parsed];
      }
      
      const validItems = items.filter(item => item && typeof item === 'object' && item.title);
      
      if (validItems.length === 0) {
        setParseError("No valid items found. Each item needs at least a 'title' field.");
        return;
      }
      
      setParsedItems(validItems.slice(0, 200));
      
      if (items.length > 200) {
        setParseError(`Only first 200 items shown (${items.length} total). Maximum 200 per import.`);
      }
    } catch (err) {
      setParseError(`Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  };

  const parseCsv = (csvText: string) => {
    setParseError(null);
    setParsedItems([]);
    
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      setParseError("CSV needs at least a header row and one data row");
      return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const titleIndex = headers.findIndex(h => h === 'title' || h === 'name' || h === 'product');
    
    if (titleIndex === -1) {
      setParseError("CSV must have a 'title', 'name', or 'product' column");
      return;
    }
    
    const items: ImportItem[] = [];
    
    for (let i = 1; i < Math.min(lines.length, 201); i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      
      const item: ImportItem = {
        title: values[titleIndex] || '',
      };
      
      headers.forEach((header, idx) => {
        const val = values[idx];
        if (!val) return;
        
        if (header === 'description' || header === 'desc') item.description = val;
        if (header === 'price') item.price = val;
        if (header === 'currency') item.currency = val;
        if (header === 'category' || header === 'cat') item.category = val;
        if (header === 'subcategory' || header === 'subcat') item.subcategory = val;
        if (header === 'image' || header === 'imageurl' || header === 'image_url') item.imageUrl = val;
        if (header === 'sku' || header === 'id' || header === 'product_id') item.sku = val;
        if (header === 'availability' || header === 'status') item.availability = val;
      });
      
      if (item.title) {
        items.push(item);
      }
    }
    
    setParsedItems(items);
    
    if (lines.length > 201) {
      setParseError(`Only first 200 items shown (${lines.length - 1} total). Maximum 200 per import.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    
    if (file.name.endsWith('.csv')) {
      parseCsv(text);
    } else {
      setJsonInput(text);
      parseJson(text);
    }
  };

  const handleImport = async () => {
    if (parsedItems.length === 0 || !slug) return;
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const response = await fetch(`/api/orbit/${slug}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: parsedItems,
          clearExisting,
          boxType,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        toast({
          title: "Import failed",
          description: result.message || "Error importing items",
          variant: "destructive",
        });
        return;
      }
      
      setImportResult(result);
      
      toast({
        title: "Import complete",
        description: `${result.imported} items imported, ${result.skipped} skipped`,
      });
      
      setJsonInput("");
      setParsedItems([]);
    } catch (error) {
      toast({
        title: "Import error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const categories = Array.from(new Set(parsedItems.map(i => i.category).filter((c): c is string => Boolean(c))));

  return (
    <OrbitLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-import-title">
            Import Data
          </h1>
          <p className="text-white/60 text-sm">
            Import products, menu items, or extract insights from a website
          </p>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="manual" className="data-[state=active]:bg-pink-500" data-testid="tab-manual-import">
              <Upload className="w-4 h-4 mr-2" />
              Manual Import
            </TabsTrigger>
            <TabsTrigger value="website" className="data-[state=active]:bg-pink-500" data-testid="tab-website-intelligence">
              <Globe className="w-4 h-4 mr-2" />
              Website Intelligence
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-pink-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Upload File</h2>
              </div>
              
              <div className="flex gap-2 mb-4">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-json"
                  />
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-white/5 border border-dashed border-white/20 hover:border-pink-400 transition-colors">
                    <FileJson className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-white/70">JSON</span>
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-csv"
                  />
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-white/5 border border-dashed border-white/20 hover:border-pink-400 transition-colors">
                    <FileSpreadsheet className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-white/70">CSV</span>
                  </div>
                </label>
              </div>
              
              <div className="mb-2">
                <label className="text-sm text-white/60 block mb-1">Or paste JSON:</label>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    parseJson(e.target.value);
                  }}
                  placeholder={`[
  { "title": "Product Name", "price": "9.99", "category": "Drinks" },
  { "title": "Another Item", "price": "12.50", "category": "Food" }
]`}
                  className="bg-white/5 border-white/10 text-white font-mono text-sm min-h-[200px]"
                  data-testid="input-json"
                />
              </div>
              
              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Import Options</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-white/70">Type:</label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={boxType === 'product' ? 'default' : 'outline'}
                      onClick={() => setBoxType('product')}
                      className={boxType === 'product' ? 'bg-pink-500 hover:bg-pink-600' : ''}
                      data-testid="button-type-product"
                    >
                      Product
                    </Button>
                    <Button
                      size="sm"
                      variant={boxType === 'menu_item' ? 'default' : 'outline'}
                      onClick={() => setBoxType('menu_item')}
                      className={boxType === 'menu_item' ? 'bg-pink-500 hover:bg-pink-600' : ''}
                      data-testid="button-type-menu"
                    >
                      Menu Item
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Clear existing items</p>
                    <p className="text-xs text-white/50">Replace all existing {boxType === 'menu_item' ? 'menu items' : 'products'}</p>
                  </div>
                  <Switch
                    checked={clearExisting}
                    onCheckedChange={setClearExisting}
                    data-testid="toggle-clear-existing"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Preview</h2>
                </div>
                {parsedItems.length > 0 && (
                  <Badge variant="secondary" className="bg-pink-500/20 text-pink-300">
                    {parsedItems.length} items
                  </Badge>
                )}
              </div>
              
              {parsedItems.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No items to preview</p>
                  <p className="text-xs">Upload or paste data to see preview</p>
                </div>
              ) : (
                <>
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {categories.map(cat => (
                        <Badge key={cat} variant="outline" className="text-xs border-white/20 text-white/60">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {parsedItems.slice(0, 20).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        data-testid={`preview-item-${idx}`}
                      >
                        {item.imageUrl || item.image_url ? (
                          <img
                            src={item.imageUrl || item.image_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover bg-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                            <Package className="w-4 h-4 text-white/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{item.title}</p>
                          {item.category && (
                            <p className="text-xs text-white/40">{item.category}</p>
                          )}
                        </div>
                        {item.price && (
                          <span className="text-sm font-medium text-green-400">
                            {item.currency || '£'}{item.price}
                          </span>
                        )}
                      </div>
                    ))}
                    {parsedItems.length > 20 && (
                      <p className="text-center text-xs text-white/40 py-2">
                        + {parsedItems.length - 20} more items
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {importResult && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="text-sm text-white/70 space-y-1">
                  <p>{importResult.imported} items imported</p>
                  {importResult.skipped > 0 && (
                    <p>{importResult.skipped} duplicates skipped</p>
                  )}
                  {importResult.validationErrors > 0 && (
                    <p className="text-yellow-400">{importResult.validationErrors} items had errors</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={parsedItems.length === 0 || isImporting}
              className="w-full bg-pink-500 hover:bg-pink-600"
              data-testid="button-import"
            >
              {isImporting ? (
                "Importing..."
              ) : clearExisting ? (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Replace & Import {parsedItems.length} Items
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {parsedItems.length} Items
                </>
              )}
            </Button>
          </div>
        </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <h3 className="text-sm font-medium text-blue-300 mb-2">JSON Format</h3>
              <pre className="text-xs text-white/60 overflow-x-auto">
{`[
  {
    "title": "Margherita Pizza",
    "description": "Classic tomato and mozzarella",
    "price": "12.99",
    "category": "Pizzas",
    "tags": [{ "key": "dietary", "value": "vegetarian" }],
    "imageUrl": "https://..."
  }
]`}
              </pre>
            </div>
          </TabsContent>
          
          <TabsContent value="website" className="mt-6">
            <div className="space-y-6">
              <UrlIngestForm
                onSubmit={handleUrlIngest}
                isLoading={ingestMutation.isPending}
                error={ingestMutation.error?.message}
                lastUrl={lastUrl}
              />
              
              {ingestMutation.isPending && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-6">
                    <Globe className="w-16 h-16 text-white/30" />
                    <Loader2 className="w-8 h-8 text-pink-400 absolute -bottom-2 -right-2 animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Analyzing Website
                  </h3>
                  <p className="text-white/60 max-w-md">
                    Crawling pages, extracting content, and generating insights. This may take up to 60 seconds.
                  </p>
                </div>
              )}
              
              {!ingestMutation.isPending && crawlReport && (
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-white font-medium">
                        {crawlReport.pagesSucceeded} of {crawlReport.pagesAttempted} pages scanned
                      </span>
                    </div>
                    <div className="text-white/60">
                      {tiles.length} tiles generated
                    </div>
                    <div className="text-white/60">
                      {(crawlReport.crawlDurationMs / 1000).toFixed(1)}s
                    </div>
                    {resultMessage && (
                      <div className="text-white/60 italic">
                        {resultMessage}
                      </div>
                    )}
                  </div>
                  
                  {crawlReport.errors.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-amber-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {crawlReport.errors.length} page{crawlReport.errors.length > 1 ? 's' : ''} could not be crawled
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {!ingestMutation.isPending && tileRows.length > 0 && (
                <div className="space-y-8">
                  {tileRows.map((row) => (
                    <TileRow
                      key={row.title}
                      title={row.title}
                      tiles={row.tiles}
                      onTileClick={setSelectedTile}
                    />
                  ))}
                </div>
              )}
              
              {!ingestMutation.isPending && tiles.length === 0 && lastUrl && !ingestMutation.error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Globe className="w-16 h-16 text-white/30 mb-6" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No tiles generated
                  </h3>
                  <p className="text-white/60 max-w-md">
                    We couldn't extract enough content from this website. Try a different URL or check if the site is accessible.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <TileDrawerOverlay 
          isOpen={!!selectedTile} 
          onClose={() => setSelectedTile(null)} 
        />
        <TileDrawer 
          tile={selectedTile} 
          onClose={() => setSelectedTile(null)} 
        />
      </div>
    </OrbitLayout>
  );
}
