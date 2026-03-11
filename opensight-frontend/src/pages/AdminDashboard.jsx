import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import AdminConsole from "@/components/admin/AdminConsole";

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const guard = async () => {
      try {
        const me = await User.me();
        if (me.role === 'admin') {
          setIsAdmin(true);
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
    return <div className="w-screen h-screen flex items-center justify-center bg-black/80 text-white">Loading Admin Console...</div>;
  }

  if (!isAdmin) return null;

  return <AdminConsole />;
}