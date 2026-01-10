/**
 * Orbit Tile Storage
 * 
 * File-based storage for orbit ingestion results.
 * Stores crawl data and tiles in /data/orbits/<orbitId>.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { OrbitIngestResult, OrbitTile, OrbitCrawlReport } from '../../shared/orbitTileTypes';

const DATA_DIR = path.join(process.cwd(), 'data', 'orbits');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[OrbitTileStorage] Created data directory: ${DATA_DIR}`);
  }
}

function getFilePath(orbitId: string): string {
  return path.join(DATA_DIR, `${orbitId}.json`);
}

export async function saveOrbitIngestion(result: OrbitIngestResult): Promise<void> {
  ensureDataDir();
  const filePath = getFilePath(result.orbitId);
  
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`[OrbitTileStorage] Saved orbit ${result.orbitId} to ${filePath}`);
  } catch (error: any) {
    console.error(`[OrbitTileStorage] Failed to save orbit ${result.orbitId}:`, error.message);
    throw error;
  }
}

export async function loadOrbitIngestion(orbitId: string): Promise<OrbitIngestResult | null> {
  ensureDataDir();
  const filePath = getFilePath(orbitId);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[OrbitTileStorage] Orbit ${orbitId} not found`);
      return null;
    }
    
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(data) as OrbitIngestResult;
  } catch (error: any) {
    console.error(`[OrbitTileStorage] Failed to load orbit ${orbitId}:`, error.message);
    return null;
  }
}

export async function listOrbits(): Promise<string[]> {
  ensureDataDir();
  
  try {
    const files = await fs.promises.readdir(DATA_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error: any) {
    console.error('[OrbitTileStorage] Failed to list orbits:', error.message);
    return [];
  }
}

export async function deleteOrbitIngestion(orbitId: string): Promise<boolean> {
  const filePath = getFilePath(orbitId);
  
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[OrbitTileStorage] Deleted orbit ${orbitId}`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error(`[OrbitTileStorage] Failed to delete orbit ${orbitId}:`, error.message);
    return false;
  }
}

export async function getOrbitTiles(orbitId: string): Promise<OrbitTile[] | null> {
  const result = await loadOrbitIngestion(orbitId);
  return result?.tiles || null;
}

export async function getOrbitCrawlReport(orbitId: string): Promise<OrbitCrawlReport | null> {
  const result = await loadOrbitIngestion(orbitId);
  return result?.crawlReport || null;
}

export interface OrbitCacheCheck {
  exists: boolean;
  withinCachePeriod: boolean;
  orbitId?: string;
  scannedAt?: string;
}

export async function checkOrbitCache(inputUrl: string, cachePeriodHours: number = 24): Promise<OrbitCacheCheck> {
  ensureDataDir();
  
  try {
    const files = await fs.promises.readdir(DATA_DIR);
    const normalizedUrl = inputUrl.toLowerCase().replace(/\/+$/, '');
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(DATA_DIR, file);
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const orbit = JSON.parse(data) as OrbitIngestResult;
      
      const orbitUrl = orbit.inputUrl.toLowerCase().replace(/\/+$/, '');
      if (orbitUrl === normalizedUrl) {
        const scannedAt = new Date(orbit.scannedAt);
        const now = new Date();
        const hoursSinceScanned = (now.getTime() - scannedAt.getTime()) / (1000 * 60 * 60);
        
        return {
          exists: true,
          withinCachePeriod: hoursSinceScanned < cachePeriodHours,
          orbitId: orbit.orbitId,
          scannedAt: orbit.scannedAt,
        };
      }
    }
  } catch (error: any) {
    console.error('[OrbitTileStorage] Cache check error:', error.message);
  }
  
  return { exists: false, withinCachePeriod: false };
}
