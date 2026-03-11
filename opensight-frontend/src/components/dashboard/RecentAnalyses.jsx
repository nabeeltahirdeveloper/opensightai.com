import React from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Eye, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function RecentAnalyses({ analyses, isLoading }) {
  const { t } = useTranslation('dashboard');
  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
        <CardHeader>
          <CardTitle>{t('recentAnalyses.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
      <CardHeader className="border-b border-slate-100">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            {t('recentAnalyses.title')}
          </CardTitle>
          <Link to={createPageUrl("History")}>
            <Button variant="outline" size="sm">{t('recentAnalyses.viewAll')}</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {analyses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{t('recentAnalyses.noAnalyses')}</h3>
            <p className="text-slate-500 mb-4">{t('recentAnalyses.noAnalysesDescription')}</p>
            <Link to={createPageUrl("ChartAnalysis")}>
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                {t('recentAnalyses.startAnalyzing')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.slice(0, 5).map((analysis, index) => (
              <motion.div
                key={analysis.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={analysis.chart_image_url}
                      alt="Chart"
                      className="w-12 h-12 rounded-lg object-cover border-2 border-slate-200"
                    />
                    {analysis.status === 'completed' && analysis.analysis_result && (
                      <div className="absolute -top-1 -right-1">
                        {analysis.analysis_result.trend_direction === 'bullish' ? (
                          <TrendingUp className="w-4 h-4 text-green-500 bg-white rounded-full p-0.5" />
                        ) : analysis.analysis_result.trend_direction === 'bearish' ? (
                          <TrendingDown className="w-4 h-4 text-red-500 bg-white rounded-full p-0.5" />
                        ) : null}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <p className="font-semibold text-slate-800">
                      {(() => {
                        const fromServer = analysis.symbol;
                        const fromModel = analysis.analysis_result && (analysis.analysis_result.coin_symbol || analysis.analysis_result.coin_name);
                        const best = (fromServer && fromServer !== 'Unknown') ? fromServer : (fromModel ? String(fromModel).trim() : '');
                        return best || t('recentAnalyses.analysis');
                      })()}
                    </p>
                    <p className="text-sm text-slate-500">
                      {(() => {
                        try {
                          const d = analysis.created_date ? new Date(analysis.created_date) : null;
                          return d && !isNaN(d) ? format(d, "MMM d, HH:mm") : '';
                        } catch (_e) {
                          return '';
                        }
                      })()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={
                    analysis.status === 'completed' ? 'default' :
                    analysis.status === 'analyzing' ? 'secondary' : 'destructive'
                  }>
                    {t(`recentAnalyses.status.${analysis.status}`, { defaultValue: analysis.status })}
                  </Badge>
                  
                  {analysis.status === 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => analysis.chart_image_url && window.open(analysis.chart_image_url, '_blank')}
                      disabled={!analysis.chart_image_url}
                      title={analysis.chart_image_url ? t('recentAnalyses.viewChart') : t('recentAnalyses.noChartAvailable')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}