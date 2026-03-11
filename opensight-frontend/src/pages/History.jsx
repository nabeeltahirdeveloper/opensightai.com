import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { ChartAnalysis as ChartAnalysisEntity } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  History as HistoryIcon, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  ExternalLink,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

import AnalysisCard from "../components/history/AnalysisCard";
import FilterTabs from "../components/history/FilterTabs";

export default function History() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trendFilter, setTrendFilter] = useState("all");

  useEffect(() => {
    loadAnalyses();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [analyses, searchTerm, statusFilter, trendFilter]);

  const loadAnalyses = async () => {
    try {
      const serverAnalyses = await ChartAnalysisEntity.listAnalyses(50);
      const mapped = (serverAnalyses || []).map(a => ({
        id: a.id,
        chart_image_url: a.image_url,
        symbol: a.symbol,
        created_date: a.created_at,
        status: 'completed',
        analysis_result: a.analysis_json,
      }));
      setAnalyses(mapped);
    } catch (error) {
      console.error("Error loading analyses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = analyses;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(analysis =>
        analysis.symbol?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(analysis => analysis.status === statusFilter);
    }

    // Trend filter
    if (trendFilter !== "all") {
      filtered = filtered.filter(analysis =>
        analysis.analysis_result?.trend_direction === trendFilter
      );
    }

    setFilteredAnalyses(filtered);
  };

  const getStats = () => {
    const completed = analyses.filter(a => a.status === 'completed');
    const bullish = completed.filter(a => a.analysis_result?.trend_direction === 'bullish');
    const bearish = completed.filter(a => a.analysis_result?.trend_direction === 'bearish');
    
    return {
      total: analyses.length,
      completed: completed.length,
      bullish: bullish.length,
      bearish: bearish.length,
      success_rate: completed.length > 0 ? Math.round((completed.filter(a => a.analysis_result?.confidence_level > 0.7).length / completed.length) * 100) : 0
    };
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {t('history.title', { ns: 'dashboard' })}
          </h1>
          <p className="text-slate-600 text-lg">
            {t('history.subtitle', { ns: 'dashboard' })}
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-slate-600">{t('history.totalAnalyses', { ns: 'dashboard' })}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.bullish}</div>
              <div className="text-sm text-slate-600">{t('history.bullishSignals', { ns: 'dashboard' })}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.bearish}</div>
              <div className="text-sm text-slate-600">{t('history.bearishSignals', { ns: 'dashboard' })}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.completed}</div>
              <div className="text-sm text-slate-600">{t('history.completed', { ns: 'dashboard' })}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.success_rate}%</div>
              <div className="text-sm text-slate-600">{t('history.successRate', { ns: 'dashboard' })}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder={t('history.searchPlaceholder', { ns: 'dashboard' })}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <FilterTabs
                statusFilter={statusFilter}
                trendFilter={trendFilter}
                onStatusChange={setStatusFilter}
                onTrendChange={setTrendFilter}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid gap-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-600">{t('history.loading', { ns: 'dashboard' })}</p>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="p-12 text-center">
                <HistoryIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  {analyses.length === 0 ? t('history.noAnalysesYet', { ns: 'dashboard' }) : t('history.noResultsFound', { ns: 'dashboard' })}
                </h3>
                <p className="text-slate-600">
                  {analyses.length === 0 
                    ? t('history.startAnalyzing', { ns: 'dashboard' })
                    : t('history.adjustFilters', { ns: 'dashboard' })
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredAnalyses.map((analysis, index) => (
                <AnalysisCard key={analysis.id} analysis={analysis} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}