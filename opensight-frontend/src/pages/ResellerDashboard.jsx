import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import ResellerDashboard from "@/components/reseller/ResellerDashboard";

export default function ResellerDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isReseller, setIsReseller] = useState(false);

  useEffect(() => {
    const guard = async () => {
      try {
        const me = await User.me();
        if (me.role === 'reseller') {
          setIsReseller(true);
        } else if (me.role === 'brand') {
          window.location.href = createPageUrl("BrandDashboard");
        } else if (me.role === 'admin') {
          window.location.href = createPageUrl("AdminDashboard");
        } else {
          window.location.href = createPageUrl("Dashboard");
        }
      } catch (e) {
        window.location.href = createPageUrl("Login");
      } finally {
        setIsLoading(false);
      }
    };
    guard();
  }, []);

  if (isLoading) {
    return <div className="w-screen h-screen flex items-center justify-center bg-black/80 text-white">Loading Reseller Dashboard...</div>;
  }

  if (!isReseller) return null;

  return <ResellerDashboard />;
}


