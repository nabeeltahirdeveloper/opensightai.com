import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function LoadingAnalysis() {
  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center justify-center">
          <Brain className="w-6 h-6 text-blue-600" />
          AI Analysis in Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="text-center space-y-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </motion.div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-800">
              Analyzing Your Chart
            </h3>
            <p className="text-slate-600">
              Our AI is examining technical patterns, support/resistance levels, and market signals...
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              "Trend Analysis",
              "Support/Resistance",
              "Entry Points",
              "Risk Management"
            ].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  delay: index * 0.5 
                }}
                className="p-3 bg-blue-50 rounded-lg text-sm font-medium text-blue-700"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}