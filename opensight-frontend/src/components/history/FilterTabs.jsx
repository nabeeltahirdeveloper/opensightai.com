import React from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, CheckCircle, Clock, XCircle } from "lucide-react";

export default function FilterTabs({ 
  statusFilter, 
  trendFilter, 
  onStatusChange, 
  onTrendChange 
}) {
  const { t } = useTranslation(['dashboard']);
  const statusOptions = [
    { value: "all", labelKey: "history.filters.allStatus", icon: BarChart3 },
    { value: "completed", labelKey: "history.filters.completed", icon: CheckCircle },
    { value: "analyzing", labelKey: "history.filters.analyzing", icon: Clock },
    { value: "failed", labelKey: "history.filters.failed", icon: XCircle }
  ];

  const trendOptions = [
    { value: "all", labelKey: "history.filters.allTrends", icon: BarChart3 },
    { value: "bullish", labelKey: "history.filters.bullish", icon: TrendingUp },
    { value: "bearish", labelKey: "history.filters.bearish", icon: TrendingDown },
    { value: "sideways", labelKey: "history.filters.sideways", icon: BarChart3 }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            variant={statusFilter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onStatusChange(option.value)}
            className="flex items-center gap-2"
          >
            <option.icon className="w-3 h-3" />
            {t(option.labelKey, { ns: 'dashboard' })}
          </Button>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {trendOptions.map((option) => (
          <Button
            key={option.value}
            variant={trendFilter === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onTrendChange(option.value)}
            className="flex items-center gap-2"
          >
            <option.icon className="w-3 h-3" />
            {t(option.labelKey, { ns: 'dashboard' })}
          </Button>
        ))}
      </div>
    </div>
  );
}