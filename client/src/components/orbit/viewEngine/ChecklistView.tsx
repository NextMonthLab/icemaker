import { useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertCircle, Star, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistViewData, ChecklistItem } from "@shared/orbitViewEngine";
import { orbitTokens } from "@/lib/designTokens";

interface ChecklistViewProps {
  data: ChecklistViewData;
  onToggle?: (id: string, checked: boolean) => void;
}

export function ChecklistView({ data, onToggle }: ChecklistViewProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(data.items.filter(i => i.checked).map(i => i.id))
  );

  const handleToggle = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
    onToggle?.(id, newChecked.has(id));
  };

  const mustHaves = data.items.filter(i => i.priority === 'must_have');
  const niceToHaves = data.items.filter(i => i.priority === 'nice_to_have');
  const dealbreakers = data.items.filter(i => i.priority === 'dealbreaker');

  const completedCount = checkedItems.size;
  const totalCount = data.items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col p-4">
      {data.title && (
        <h3 className="text-sm font-medium text-white mb-1">{data.title}</h3>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full"
            style={{ backgroundColor: orbitTokens.typeAccents.product }}
          />
        </div>
        <span className="text-xs text-white/60 tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>

      {data.summary && (
        <p className="text-xs text-white/50 mb-4">{data.summary}</p>
      )}

      {dealbreakers.length > 0 && (
        <ChecklistSection
          title="Dealbreakers"
          items={dealbreakers}
          checkedItems={checkedItems}
          onToggle={handleToggle}
          icon={<AlertCircle className="w-3.5 h-3.5 text-red-400" />}
          accentColor="red"
        />
      )}

      {mustHaves.length > 0 && (
        <ChecklistSection
          title="Must Have"
          items={mustHaves}
          checkedItems={checkedItems}
          onToggle={handleToggle}
          icon={<Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          accentColor="amber"
        />
      )}

      {niceToHaves.length > 0 && (
        <ChecklistSection
          title="Nice to Have"
          items={niceToHaves}
          checkedItems={checkedItems}
          onToggle={handleToggle}
          icon={<Circle className="w-3.5 h-3.5 text-white/40" />}
          accentColor="white"
        />
      )}
    </div>
  );
}

function ChecklistSection({
  title,
  items,
  checkedItems,
  onToggle,
  icon,
  accentColor,
}: {
  title: string;
  items: ChecklistItem[];
  checkedItems: Set<string>;
  onToggle: (id: string) => void;
  icon: React.ReactNode;
  accentColor: 'red' | 'amber' | 'white';
}) {
  const colorMap = {
    red: 'border-red-500/30 bg-red-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    white: 'border-white/10 bg-white/5',
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
          {title}
        </span>
      </div>
      
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isChecked = checkedItems.has(item.id);
          
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onToggle(item.id)}
              className={cn(
                "w-full text-left p-3 rounded-xl border transition-all",
                colorMap[accentColor],
                isChecked && "opacity-60"
              )}
              data-testid={`checklist-item-${item.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors",
                  isChecked 
                    ? "bg-pink-500 border-pink-500" 
                    : "border-white/30"
                )}>
                  {isChecked && <Check className="w-3 h-3 text-white" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm text-white transition-all",
                    isChecked && "line-through text-white/50"
                  )}>
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-white/40 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
