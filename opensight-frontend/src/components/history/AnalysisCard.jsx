import React from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  ExternalLink, 
  Target,
  DollarSign
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { formatAssetPrice } from "@/lib/utils";

export default function AnalysisCard({ analysis, index }) {
  const { t } = useTranslation(['dashboard']);
  const result = analysis.analysis_result;
  const displaySymbol = (() => {
    const fromServer = analysis.symbol;
    const fromModel = result && (result.coin_symbol || result.coin_name);
    const best = (fromServer && fromServer !== 'Unknown') ? fromServer : (fromModel ? String(fromModel).trim() : '');
    return best || 'Analysis';
  })();
  
  const getTrendColor = (trend) => {
    switch (trend) {
      case 'bullish': return 'text-green-600 bg-green-100 border-green-200';
      case 'bearish': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'bullish': return <TrendingUp className="w-4 h-4" />;
      case 'bearish': return <TrendingDown className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Chart Preview */}
            <div className="md:w-48 flex-shrink-0">
              <img
                src={analysis.chart_image_url}
                alt={t('history.chart', { ns: 'dashboard' })}
                className="w-full h-32 object-cover rounded-lg border-2 border-slate-200"
              />
              <div className="mt-2 text-center">
                <p className="font-semibold text-slate-800">{displaySymbol}</p>
                <p className="text-sm text-slate-500">
                  {format(new Date(analysis.created_date), "MMM d, HH:mm")}
                </p>
              </div>
            </div>

            {/* Analysis Details */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant={analysis.status === 'completed' ? 'default' : 'secondary'}>
                  {t(`history.status.${analysis.status}`, { ns: 'dashboard', defaultValue: analysis.status })}
                </Badge>
                
                {result && (
                  <>
                    <Badge className={getTrendColor(result.trend_direction)}>
                      {getTrendIcon(result.trend_direction)}
                      {result.trend_direction?.toUpperCase()}
                    </Badge>
                    
                    <Badge variant="outline">
                      {Math.round(result.confidence_level * 100)}% {t('history.confidence', { ns: 'dashboard' })}
                    </Badge>
                  </>
                )}
              </div>

              {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-600 font-medium">{t('history.entry', { ns: 'dashboard' })}</p>
                    <p className="text-sm font-bold text-green-700">
                      {typeof result.entry_price === 'number' ? `$${formatAssetPrice(result.entry_price)}` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                    <Target className="w-4 h-4 text-red-600 mx-auto mb-1" />
                    <p className="text-xs text-red-600 font-medium">{t('history.stopLoss', { ns: 'dashboard' })}</p>
                    <p className="text-sm font-bold text-red-700">
                      {typeof result.stop_loss === 'number' ? `$${formatAssetPrice(result.stop_loss)}` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Target className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-blue-600 font-medium">{t('history.tp1', { ns: 'dashboard' })}</p>
                    <p className="text-sm font-bold text-blue-700">
                      {typeof result.take_profit_1 === 'number' ? `$${formatAssetPrice(result.take_profit_1)}` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <Target className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-purple-600 font-medium">{t('history.tp2', { ns: 'dashboard' })}</p>
                    <p className="text-sm font-bold text-purple-700">
                      {typeof result.take_profit_2 === 'number' ? `$${formatAssetPrice(result.take_profit_2)}` : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {result?.analysis_summary && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                  {result.analysis_summary}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(analysis.chart_image_url, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('history.viewChart', { ns: 'dashboard' })}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}