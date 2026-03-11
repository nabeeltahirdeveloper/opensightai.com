import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Users, BarChart3, Activity } from "lucide-react";

const StatCard = ({ icon: Icon, title, value, color }) => (
  <Card className="shadow-md">
    <CardContent className="p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-${color}-100`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
    </CardContent>
  </Card>
);

export default function PlatformAnalytics({ analytics }) {
  return (
    <>
      <StatCard icon={Users} title="Total Users" value={analytics.totalUsers} color="blue" />
      <StatCard icon={BarChart3} title="Total Analyses" value={analytics.totalAnalyses} color="purple" />
      <StatCard icon={Activity} title="Pro Users" value={analytics.usersByTier.pro || 0} color="green" />
    </>
  );
}