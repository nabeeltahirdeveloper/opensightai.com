import React from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Shield, 
  BarChart3, 
  DollarSign, 
  BookOpen, 
  Target 
} from "lucide-react";

const topics = [
  {
    titleKey: "topics.technicalAnalysis",
    apiTitle: "Technical Analysis",
    icon: BarChart3,
    color: "from-blue-500 to-blue-600"
  },
  {
    titleKey: "topics.riskManagement",
    apiTitle: "Risk Management",
    icon: Shield,
    color: "from-red-500 to-red-600"
  },
  {
    titleKey: "topics.tradingPsychology",
    apiTitle: "Trading Psychology",
    icon: TrendingUp,
    color: "from-green-500 to-green-600"
  },
  {
    titleKey: "topics.portfolioManagement",
    apiTitle: "Portfolio Management",
    icon: DollarSign,
    color: "from-yellow-500 to-yellow-600"
  },
  {
    titleKey: "topics.marketFundamentals",
    apiTitle: "Market Fundamentals",
    icon: BookOpen,
    color: "from-purple-500 to-purple-600"
  },
  {
    titleKey: "topics.strategyDevelopment",
    apiTitle: "Strategy Development",
    icon: Target,
    color: "from-indigo-500 to-indigo-600"
  }
];

export default function TopicSuggestions({ onTopicSelect }) {
  const { t } = useTranslation(['dashboard']);
  return (
    <div className="grid grid-cols-1 gap-2">
      {topics.map((topic) => {
        const topicTitle = t(topic.titleKey, { ns: 'dashboard' });
        return (
          <Button
            key={topic.titleKey}
            variant="outline"
            size="sm"
            onClick={() => onTopicSelect(topic.apiTitle)}
            className="justify-start gap-2 hover:shadow-md transition-all duration-200"
          >
            <div className={`w-4 h-4 bg-gradient-to-r ${topic.color} rounded-full flex items-center justify-center`}>
              <topic.icon className="w-2.5 h-2.5 text-white" />
            </div>
            {topicTitle}
          </Button>
        );
      })}
    </div>
  );
}