import React from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload, MessageSquare, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function QuickActions() {
  const { t } = useTranslation('dashboard');
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3"
    >
      <Link to={createPageUrl("ChartAnalysis")}>
        <Button className="premium-gradient hover:shadow-xl transition-all duration-300">
          <Upload className="w-4 h-4 mr-2" />
          {t('quickActions.analyzeChart')}
        </Button>
      </Link>
      <Link to={createPageUrl("AITutor")}>
        <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300">
          <Sparkles className="w-4 h-4 mr-2" />
          {t('quickActions.askAssistant')}
        </Button>
      </Link>
    </motion.div>
  );
}