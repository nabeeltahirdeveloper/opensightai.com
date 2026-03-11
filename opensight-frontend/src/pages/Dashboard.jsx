
import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { ChartAnalysis as ChartAnalysisEntity, TutorConversation } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  BarChart3, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Brain,
  Upload,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

import StatsCard from "../components/dashboard/StatsCard";
import RecentAnalyses from "../components/dashboard/RecentAnalyses";
import QuickActions from "../components/dashboard/QuickActions";
import CreditsPanel from "../components/dashboard/CreditsPanel";
import { User } from "@/api/entities";

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const [analyses, setAnalyses] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [me, setMe] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check user role first
      const user = await User.me().catch(() => null);
      
      // Redirect brand users to brand dashboard
      if (user && user.role === 'brand') {
        window.location.href = createPageUrl("BrandDashboard");
        return;
      }
      
      // Note: Admins can now view the normal user dashboard
      // Removed auto-redirect to admin dashboard to allow flexibility
      
      const [serverAnalyses, conversationsData] = await Promise.all([
        ChartAnalysisEntity.listAnalyses(10),
        TutorConversation.listConversations(5)
      ]);
      const mappedAnalyses = (serverAnalyses || []).map(a => ({
        id: a.id,
        chart_image_url: a.image_url,
        symbol: a.symbol,
        created_date: a.created_at,
        status: 'completed',
        analysis_result: a.analysis_json,
      }));
      setAnalyses(mappedAnalyses);
      setConversations(conversationsData || []);
      setMe(user);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const completedAnalyses = analyses.filter(a => a.status === 'completed');
  const successRate = completedAnalyses.length > 0 
    ? (completedAnalyses.filter(a => a.analysis_result?.confidence_level > 0.7).length / completedAnalyses.length * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                {t('title')}
              </h1>
              <p className="text-slate-600 mt-2 text-lg">
                {t('subtitle')}
              </p>
            </div>
            <QuickActions />
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title={t('stats.totalAnalyses')}
            value={analyses.length}
            icon={BarChart3}
            color="orange"
            trend={t('stats.totalAnalysesTrend')}
          />
          <StatsCard
            title={t('stats.accuracyScore')}
            value={`${successRate.toFixed(1)}%`}
            icon={Target}
            color="green"
            trend={t('stats.accuracyScoreTrend')}
          />
          <StatsCard
            title={t('stats.conversations')}
            value={conversations.length}
            icon={MessageSquare}
            color="slate"
            trend={t('stats.conversationsTrend')}
          />
          <StatsCard
            title={t('stats.aiInsights')}
            value={completedAnalyses.length}
            icon={Brain}
            color="slate"
            trend={t('stats.aiInsightsTrend')}
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <RecentAnalyses analyses={analyses} isLoading={isLoading} />
          </div>
          
          <div className="space-y-6">
            <CreditsPanel 
              credits_balance={me?.credits_balance}
              credits_unlimited={me?.credits_unlimited}
              subscription_tier={me?.subscription_tier}
            />
            {/* AI Tutor Card */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200/50 shadow-xl">
              <CardHeader className="premium-gradient text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  {t('aiTutor.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-slate-600 mb-4">
                  {t('aiTutor.description')}
                </p>
                <Link to={createPageUrl("AITutor")}>
                  <Button className="w-full premium-gradient hover:shadow-lg">
                    {t('aiTutor.startLearning')}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Market Insights */}
            <Card className="bg-white/80 backdrop-blur-sm border-orange-200/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  {t('marketPulse.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">{t('marketPulse.sentiment')}</span>
                    <span className="font-semibold text-green-600">{t('marketPulse.upward')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">{t('marketPulse.volatility')}</span>
                    <span className="font-semibold text-orange-600">{t('marketPulse.moderate')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">{t('marketPulse.dataIndex')}</span>
                    <span className="font-semibold text-orange-600">65/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
