import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const colorClasses = {
  orange: {
    bg: "from-orange-500 to-orange-600",
    icon: "bg-orange-100 text-orange-600",
    trend: "text-orange-600"
  },
  green: {
    bg: "from-green-500 to-green-600",
    icon: "bg-green-100 text-green-600",
    trend: "text-green-600"
  },
  slate: {
    bg: "from-slate-500 to-slate-600",
    icon: "bg-slate-100 text-slate-600",
    trend: "text-slate-600"
  }
};

export default function StatsCard({ title, value, icon: Icon, color, trend }) {
  const colors = colorClasses[color] || colorClasses.orange;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl ${colors.icon} flex items-center justify-center`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className={`w-16 h-1 bg-gradient-to-r ${colors.bg} rounded-full`} />
          </div>
          
          <div className="space-y-2">
            <p className="text-slate-500 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            {trend && (
              <p className={`text-sm font-medium ${colors.trend}`}>{trend}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}