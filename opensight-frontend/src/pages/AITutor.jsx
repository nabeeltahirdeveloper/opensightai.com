
import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { TutorConversation, User } from "@/api/entities"; // User import retained from existing
import { InvokeLLM } from "@/api/integrations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Send, 
  Brain, 
  Sparkles, 
  BookOpen,
  TrendingUp,
  Shield,
  DollarSign,
  BarChart3,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

import ChatMessage from "../components/tutor/ChatMessage";
import TopicSuggestions from "../components/tutor/TopicSuggestions";

export default function AITutor() {
  const { t } = useTranslation(['dashboard', 'common']);
  const DOMAIN_PROFILES = {
    "Technical Analysis": {
      role: "Expert in chart patterns, indicators (RSI, MACD, MA), trends, support/resistance, entries/exits.",
      kickoff: "Let's start a Technical Analysis session. Give me a quick overview of your chart-reading approach and one question to tailor the session.",
    },
    "Risk Management": {
      role: "Expert in position sizing, stop placement, risk/reward, drawdown control, and scenario planning.",
      kickoff: "Let's focus on Risk Management. Summarize your current risk rules and ask me one question about your risk tolerance to personalize advice.",
    },
    "Trading Psychology": {
      role: "Expert in discipline, bias mitigation, routines, performance review, and emotional control.",
      kickoff: "Starting Trading Psychology coaching. Share key mindset challenges and ask me one question about your routines to tailor the plan.",
    },
    "Portfolio Management": {
      role: "Expert in diversification, rebalancing, correlation, sizing across assets, and long-term allocation.",
      kickoff: "Begin Portfolio Management. Outline your objective and horizon, then ask one question about diversification or rebalancing.",
    },
    "Market Fundamentals": {
      role: "Expert in macro drivers, valuation, supply/demand, catalysts, and data interpretation.",
      kickoff: "Kick off Market Fundamentals. What sectors or metrics do you follow? Ask one question about valuation or catalysts.",
    },
    "Strategy Development": {
      role: "Expert in hypothesis building, backtesting, validation, metrics, and iteration.",
      kickoff: "Start Strategy Development. Describe your idea and constraints, then ask one question about testing or metrics.",
    },
  };
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null); // Added user state
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
    const fetchUser = async () => {
        try {
            setUser(await User.me());
        } catch(e) {
            console.error("Failed to fetch user data:", e);
        }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    const data = await TutorConversation.listConversations(10);
    setConversations(data);
    if (data && data.length > 0) {
      setCurrentConversation(data[0]);
      try {
        const msgs = await TutorConversation.getMessages(data[0].id);
        setMessages(msgs);
      } catch (_e) {
        setMessages([]);
      }
    } else {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const startNewConversation = async (topic) => {
    // Subscription check logic
    if (user?.subscription_tier === 'starter' && (topic === 'Strategy Development' || topic === 'Market Fundamentals')) {
        alert(t('aiTutor.upgradeRequired', { ns: 'dashboard' }));
        return;
    }

    const newConversation = await TutorConversation.createConversation({
      title: `${topic} ${t('aiTutor.discussion', { ns: 'dashboard' })}`,
      topic: topic,
    });
    
    setCurrentConversation(newConversation);
    setMessages([]);
    setConversations(prev => [newConversation, ...prev]);

    // Auto-send a kickoff message to make Quick Start responsive and domain-specific
    const profile = DOMAIN_PROFILES[topic];
    if (profile?.kickoff) {
      await sendText(profile.kickoff, newConversation, topic);
    }
  };

  const buildPrompt = (input, priorMessages, topic) => {
    const lastFew = priorMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
    const style = `Write concise, conversational answers (3-6 sentences max). Use bullet points when listing. Ask a brief follow-up question when helpful.`;
    const guardrails = `Avoid investment advice or guarantees. Use neutral language (e.g., "market data", "trends").`;
    const domainRole = topic && DOMAIN_PROFILES[topic]?.role
      ? `You are an ${DOMAIN_PROFILES[topic].role}`
      : `You are a helpful AI teacher. If the question is finance-related, focus on market analysis education; otherwise answer clearly as a general teacher.`;
    return `${style}\n${guardrails}\n${domainRole}\n\nContext (last turns):\n${lastFew}\n\nUser: ${input}\nAnswer:`;
  };

  const sendText = async (text, conversationOverride = null, topicOverride = null) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    const userMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!conversationOverride) setInputMessage("");
    setIsLoading(true);

    try {
      let conversation = conversationOverride || currentConversation;
      if (!conversation) {
        conversation = await TutorConversation.createConversation({
          title: trimmed.slice(0, 50) + "...",
          topic: topicOverride || "General",
        });
        setCurrentConversation(conversation);
        setConversations(prev => [conversation, ...prev]);
      }

      // Get current language from i18n
      const currentLanguage = i18n.language || 'en';
      const assistant = await TutorConversation.sendMessage(conversation.id, { content: trimmed, temperature: 0.5, language: currentLanguage });
      const assistantMessage = { role: "assistant", content: assistant?.content || "", timestamp: assistant?.timestamp || new Date().toISOString() };
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      // Refresh user credits after each assistant reply
      try {
        const refreshed = await User.me();
        setUser(refreshed);
      } catch (_e) {}
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    await sendText(inputMessage);
  };

  const selectConversation = async (conversation) => {
    setCurrentConversation(conversation);
    try {
      const msgs = await TutorConversation.getMessages(conversation.id);
      setMessages(msgs);
    } catch (_e) {
      setMessages([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent mb-2">
            {t('aiTutor.title', { ns: 'dashboard' })}
          </h1>
          <p className="text-slate-600 text-lg">
            {t('aiTutor.subtitle', { ns: 'dashboard' })}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6 lg:h-[calc(100vh-200px)]">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* New Conversation */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-600" />
                  {t('aiTutor.quickStart', { ns: 'dashboard' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TopicSuggestions onTopicSelect={startNewConversation} />
              </CardContent>
            </Card>

            {/* Conversation History */}
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0 flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  {t('aiTutor.recentChats', { ns: 'dashboard' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      currentConversation?.id === conv.id
                        ? 'bg-orange-100 border-orange-300 border'
                        : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <p className="font-medium text-sm text-slate-800 truncate">
                      {conv.title}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-xs">
                        {conv.topic}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {format(new Date(conv.created_at || conv.created_date), "MMM d")}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0 h-full flex flex-col">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-6 h-6 text-orange-600" />
                  {currentConversation ? currentConversation.title : t('aiTutor.title', { ns: 'dashboard' })}
                </CardTitle>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-0 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        {t('aiTutor.welcome', { ns: 'dashboard' })}
                      </h3>
                      <p className="text-slate-600 mb-4">
                        {t('aiTutor.welcomeDescription', { ns: 'dashboard' })}
                      </p>
                      <div className="text-sm text-slate-500">
                        {t('aiTutor.tryAsking', { ns: 'dashboard' })}
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {messages.map((message, index) => (
                        <ChatMessage key={index} message={message} index={index} />
                      ))}
                    </AnimatePresence>
                  )}
                  
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                      <span className="text-orange-700">{t('aiTutor.thinking', { ns: 'dashboard' })}</span>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-slate-200 p-4">
                  <div className="flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={t('aiTutor.inputPlaceholder', { ns: 'dashboard' })}
                      className="flex-1"
                      disabled={isLoading}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
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
