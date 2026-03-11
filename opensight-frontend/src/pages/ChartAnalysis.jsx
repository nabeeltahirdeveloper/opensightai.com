
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { ChartAnalysis as ChartAnalysisEntity } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { User } from "@/api/entities"; // New import
import { format, isToday } from "date-fns"; // New import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Brain,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import UploadZone from "../components/analysis/UploadZone";
import AnalysisResult from "../components/analysis/AnalysisResult";
import LoadingAnalysis from "../components/analysis/LoadingAnalysis";

const TIER_LIMITS = { starter: 10, pro: 50, expert: Infinity };

export default function ChartAnalysis() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [symbol, setSymbol] = useState("");
  const [user, setUser] = useState(null); // New state for user data
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);
        } catch(e) {
            // Handle case where user is not logged in or fetch fails
            console.error("Failed to fetch user:", e);
            setUser(null); // Explicitly set user to null
        }
    }
    fetchUser();
  }, []); // Run once on component mount to fetch user data

  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        const list = await ChartAnalysisEntity.listAnalyses(200);
        setHistory(list);
      } catch (_e) {}
    }
    if (user) loadAnalyses();
  }, [user]);

  const handleFileUpload = async (file) => {
    try {
      setError(null);
      const { file_url, file_data_url, mime_type } = await UploadFile({ file });
      setUploadedFile({ file, url: file_url, dataUrl: file_data_url, mimeType: mime_type });
    } catch (error) {
      setError(t('chartAnalysis.uploadFailed', { ns: 'dashboard' }));
      console.error("Upload error:", error);
    }
  };

  const analyzeChart = async () => {
    if (!uploadedFile) {
        setError(t('chartAnalysis.pleaseUploadFirst', { ns: 'dashboard' }));
        return;
    }
    if (!user) {
        setError(t('chartAnalysis.mustLogin', { ns: 'dashboard' }));
        return;
    }

    // Credits are enforced server-side; client just proceeds

    setIsAnalyzing(true);
    setError(null);

    try {
      // Upload to Cloudinary and analyze via backend
      let image_url = uploadedFile.url;
      try {
        const up = await ChartAnalysisEntity.uploadToCloudinary({ file_data_url: uploadedFile.dataUrl, folder: 'OpenSight/charts' });
        image_url = up?.image_url || image_url;
      } catch (_e) {}

      const created = await ChartAnalysisEntity.analyze({ image_url, image_data_url: uploadedFile.dataUrl, symbol: symbol || t('chartAnalysis.unknown', { ns: 'dashboard' }) });
      const updatedAnalysis = { id: created.id, created_at: created.created_at, symbol: created.symbol, chart_image_url: created.image_url, analysis_result: created.analysis_json };

      setAnalysis(updatedAnalysis);
      setHistory(prev => [{ ...updatedAnalysis }, ...prev]);
      // Refresh user to update credits after analysis
      try {
        const refreshed = await User.me();
        setUser(refreshed);
      } catch (_e) {}
    } catch (error) {
      setError(t('chartAnalysis.analysisFailed', { ns: 'dashboard', error: error.message || t('chartAnalysis.unknownError', { ns: 'dashboard' }) }));
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setUploadedFile(null);
    setAnalysis(null);
    setError(null);
    setSymbol("");
  };

  // Calculate current limit and analyses used for display purposes
  const displayTier = user ? (user.role === "admin" ? "expert" : (user.subscription_tier || "starter")) : "starter";
  const currentLimit = TIER_LIMITS[displayTier];
  const analysesUsed = history.filter(h => { try { return isToday(new Date(h.created_at)) } catch (_e) { return false } }).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent mb-2">
            {t('chartAnalysis.title', { ns: 'dashboard' })}
          </h1>
          <p className="text-slate-600 text-lg">
            {t('chartAnalysis.subtitle', { ns: 'dashboard' })}
          </p>
          {user && ( // Display daily usage only if user data is available
            <p className="text-sm text-slate-500 mt-2">
                {currentLimit === Infinity 
                  ? t('chartAnalysis.dailyUsageUnlimited', { ns: 'dashboard', used: analysesUsed })
                  : t('chartAnalysis.dailyUsage', { ns: 'dashboard', used: analysesUsed, limit: currentLimit })
                }
            </p>
          )}
        </motion.div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {!uploadedFile && !analysis ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <UploadZone onFileUpload={handleFileUpload} />
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <LoadingAnalysis />
            </motion.div>
          ) : analysis ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <AnalysisResult analysis={analysis} onReset={resetAnalysis} />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-6 h-6 text-orange-600" />
                    {t('chartAnalysis.readyToAnalyze', { ns: 'dashboard' })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <img
                      src={uploadedFile.url}
                      alt={t('chartAnalysis.uploadedChart', { ns: 'dashboard' })}
                      className="max-w-full max-h-96 rounded-xl shadow-lg border-2 border-slate-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="symbol">{t('chartAnalysis.dataSymbol', { ns: 'dashboard' })}</Label>
                      <Input
                        id="symbol"
                        placeholder={t('chartAnalysis.dataSymbolPlaceholder', { ns: 'dashboard' })}
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        className="mt-2"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={analyzeChart}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
                        size="lg"
                        disabled={!user || isAnalyzing} // Disable button if user not loaded or analysis is in progress
                      >
                        <Brain className="w-5 h-5 mr-2" />
                        {t('chartAnalysis.analyzeChart', { ns: 'dashboard' })}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetAnalysis}
                        size="lg"
                      >
                        {t('chartAnalysis.reset', { ns: 'dashboard' })}
                      </Button>
                    </div>
                    {!user && ( // Provide a hint if user is not logged in
                        <Alert className="text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                                {t('chartAnalysis.pleaseLogin', { ns: 'dashboard' })}
                            </AlertDescription>
                        </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {history && history.length > 0 && (
          <div className="mt-8">
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>{t('chartAnalysis.previousAnalyses', { ns: 'dashboard' })}</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((h) => (
                  <div key={h.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-sm text-slate-500 mb-2">{new Date(h.created_at).toLocaleString()}</div>
                    <div className="aspect-video overflow-hidden rounded-md border border-slate-200 mb-2 bg-white">
                      <img src={h.image_url || h.chart_image_url} alt={t('chartAnalysis.chart', { ns: 'dashboard' })} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-sm font-medium text-slate-800 mb-1">{h.symbol || t('chartAnalysis.unknown', { ns: 'dashboard' })}</div>
                    <div className="text-xs text-slate-600 line-clamp-3">{h.analysis_json?.analysis_summary || h.analysis_result?.analysis_summary}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
