import { localApi } from './localApi';
import { serverApi } from './serverApi';


export const ChartAnalysis = serverApi.charts;

export const TutorConversation = serverApi.tutor;



// auth sdk:
const forceLocal =
  String(import.meta.env.VITE_USE_LOCAL_API || "").toLowerCase() === "true";

export const User = forceLocal ? localApi.auth : serverApi.auth;

// admin sdk:
export const AdminAnalytics = serverApi.admin?.analytics || { overview: async () => ({ totals: { users: 0, analyses: 0, orders: 0, revenue: 0 }, users: { pro: 0 }, recent_orders: [] }) };

console.log("forceLocal:", forceLocal, "sdk:", forceLocal ? "localApi" : "serverApi");
