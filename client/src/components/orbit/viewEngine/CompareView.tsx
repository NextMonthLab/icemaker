import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Trophy, ChevronDown, ChevronUp, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompareViewData, CompareRow } from "@shared/orbitViewEngine";
import { orbitTokens } from "@/lib/designTokens";

interface CompareViewProps {
  data: CompareViewData;
  onAskAbout?: (query: string) => void;
}

export function CompareView({ data, onAskAbout }: CompareViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
  };

  const sortedRows = [...data.rows].sort((a, b) => {
    if (!sortColumn) {
      return (b.score || 0) - (a.score || 0);
    }
    const aVal = a.attributes[sortColumn];
    const bVal = b.attributes[sortColumn];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr) 
      : bStr.localeCompare(aStr);
  });

  const winner = data.winner_id ? data.rows.find(r => r.id === data.winner_id) : null;

  return (
    <div className="flex flex-col">
      {winner && (
        <div 
          className="mx-4 mt-4 p-3 rounded-xl border"
          style={{
            backgroundColor: orbitTokens.winner.bg,
            borderColor: orbitTokens.winner.border,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: orbitTokens.winner.text }} />
            <span className="text-xs font-medium" style={{ color: orbitTokens.winner.text }}>Top Pick</span>
          </div>
          <p className="text-sm text-white font-medium">{winner.name}</p>
          {winner.verdict && (
            <p className="text-xs text-white/60 mt-1">{winner.verdict}</p>
          )}
        </div>
      )}

      {data.verdict && !winner && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-white/80">{data.verdict}</p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-2 text-xs font-medium text-white/40">
                Product
              </th>
              {data.columns.filter(c => c.priority === 'high').map(col => (
                <th 
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left px-3 py-2 text-xs font-medium text-white/40 cursor-pointer hover:text-white/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortColumn === col.key && (
                      sortDirection === 'asc' 
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <motion.tr 
                key={row.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                style={{
                  backgroundColor: row.id === data.winner_id ? orbitTokens.winner.bg : undefined,
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.image ? (
                      <img 
                        src={row.image} 
                        alt={row.name}
                        className="w-10 h-10 rounded-lg object-cover bg-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <span className="text-xs text-white/40">
                          {row.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white">{row.name}</p>
                        {row.id === data.winner_id && (
                          <Star className="w-3 h-3 fill-current" style={{ color: orbitTokens.winner.text }} />
                        )}
                      </div>
                      {row.brand && (
                        <p className="text-xs text-white/40">{row.brand}</p>
                      )}
                      {row.price && (
                        <p className="text-xs text-white/60">{row.price}</p>
                      )}
                    </div>
                  </div>
                </td>
                {data.columns.filter(c => c.priority === 'high').map(col => (
                  <td key={col.key} className="px-3 py-3">
                    <span className="text-sm text-white/80">
                      {String(row.attributes[col.key] || '—')}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-3">
                  <button
                    onClick={() => onAskAbout?.(`Tell me more about ${row.name}`)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors group"
                    title="Ask about this"
                    data-testid={`ask-about-${row.id}`}
                  >
                    <MessageCircle className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.columns.some(c => c.priority !== 'high') && (
        <details className="mx-4 mt-4 mb-4">
          <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors">
            Show more attributes
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {data.columns.filter(c => c.priority !== 'high').map(col => (
              <div key={col.key} className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-white/40 mb-1">{col.label}</p>
                <div className="space-y-1">
                  {data.rows.map(row => (
                    <div key={row.id} className="flex justify-between text-xs">
                      <span className="text-white/60 truncate">{row.name}</span>
                      <span className="text-white/80">{String(row.attributes[col.key] || '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="px-4 py-3 border-t border-white/10">
        <button
          onClick={() => onAskAbout?.("Which option is best for my needs?")}
          className="w-full py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-sm font-medium transition-colors"
          data-testid="ask-for-recommendation"
        >
          Help me decide
        </button>
      </div>
    </div>
  );
}
