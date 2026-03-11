import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import BrandDashboard from "@/components/brand/BrandDashboard";

export default function BrandDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isBrand, setIsBrand] = useState(false);

  useEffect(() => {
    const guard = async () => {
      try {
        const me = await User.me();
        if (me.role === 'brand') {
          setIsBrand(true);
        } else if (me.role === 'reseller') {
          window.location.href = createPageUrl("ResellerDashboard");
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
    return <div className="w-screen h-screen flex items-center justify-center bg-black/80 text-white">Loading Brand Dashboard...</div>;
  }

  if (!isBrand) return null;

  return <BrandDashboard />;
}

