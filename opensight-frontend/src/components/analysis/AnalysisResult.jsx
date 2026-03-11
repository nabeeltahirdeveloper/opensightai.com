import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatAssetPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  DollarSign,
  BarChart3,
  RefreshCw,
  CheckCircle
} from "lucide-react";
import { motion } from "framer-motion";

export default function AnalysisResult({ analysis, onReset }) {
  const result = analysis.analysis_result;
  if (!result) return null;

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'bullish': return 'text-green-600 bg-green-100';
      case 'bearish': return 'text-red-600 bg-red-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'bullish': return <TrendingUp className="w-4 h-4" />;
      case 'bearish': return <TrendingDown className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  const confidencePercentage = Math.round(result.confidence_level * 100);
  const detectedSymbol = (result?.coin_symbol || result?.coin_name || "").trim();
  const displaySymbol = (analysis?.symbol && analysis.symbol !== 'Unknown') ? analysis.symbol : (detectedSymbol || analysis?.symbol || 'Unknown');
  const positionEntry = (() => {
    switch (result.trend_direction) {
      case 'bullish': return { label: 'Long', color: 'text-green-700' };
      case 'bearish': return { label: 'Short', color: 'text-red-700' };
      default: return { label: 'Neutral', color: 'text-slate-600' };
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-800 mb-2">
                Analysis Complete
              </CardTitle>
              {displaySymbol && (
                <CardDescription className="text-slate-600 mb-2">
                  Coin: {displaySymbol}
                </CardDescription>
              )}
              <div className="flex items-center gap-3">
                <Badge className={getTrendColor(result.trend_direction)}>
                  {getTrendIcon(result.trend_direction)}
                  {result.trend_direction.toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {confidencePercentage}% Confidence
                </Badge>
              </div>
            </div>
            <Button onClick={onReset} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart Preview */}
        <div className="lg:col-span-1">
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="text-lg">Chart Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={analysis.chart_image_url}
                alt="Analyzed chart"
                className="w-full rounded-lg shadow-md"
              />
              <div className="mt-4">
                <p className="text-sm text-slate-600">
                  <strong>Symbol:</strong> {displaySymbol}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Time Frame:</strong> {result.time_frame || 'Not specified'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trading Signals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Levels */}
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Trading Levels
              </CardTitle>
              <CardDescription className={`mt-1 font-medium ${positionEntry.color}`}>
                Position Entry: {positionEntry.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-800">Entry Price</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {typeof result.entry_price === 'number' ? `$${formatAssetPrice(result.entry_price)}` : 'N/A'}
                    </p>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="font-semibold text-red-800">Stop Loss</span>
                    </div>
                    <p className="text-2xl font-bold text-red-700">
                      {typeof result.stop_loss === 'number' ? `$${formatAssetPrice(result.stop_loss)}` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-800">Take Profit 1</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {typeof result.take_profit_1 === 'number' ? `$${formatAssetPrice(result.take_profit_1)}` : 'N/A'}
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold text-purple-800">Take Profit 2</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      {typeof result.take_profit_2 === 'number' ? `$${formatAssetPrice(result.take_profit_2)}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {result.risk_reward_ratio && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Risk/Reward Ratio</span>
                    <span className="text-xl font-bold text-blue-600">
                      1:{result.risk_reward_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Levels */}
          {result.key_levels && result.key_levels.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader>
                <CardTitle>Key Support & Resistance Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.key_levels.map((level, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <span className="font-medium text-slate-800">{level.type}</span>
                        <span className="ml-2 text-sm text-slate-500">({level.strength})</span>
                      </div>
                      <span className="font-bold text-slate-700">
                        {typeof level.price === 'number' ? `$${formatAssetPrice(level.price)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Summary */}
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Market Analysis</h4>
                  <p className="text-slate-700">{result.analysis_summary}</p>
                </div>
                
                {result.trading_strategy && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Trading Strategy</h4>
                    <p className="text-slate-700">{result.trading_strategy}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}