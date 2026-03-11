

import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User, ChartAnalysis as ChartAnalysisEntity } from "@/api/entities";
import { BarChart3, MessageSquare, History, Home, TrendingUp, Settings, Shield, CreditCard, Coins, LogOut } from "lucide-react";
import CartIcon from "@/components/cart/CartIcon";
import CurrencySelector from "@/components/CurrencySelector";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { creditPackages as fallbackCreditPackages } from "@/data/packages";
import { serverApi } from '@/api/serverApi';

// Navigation items will be translated in the component
const navigationItems = [
  {
    titleKey: "navigation.dashboard",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    titleKey: "navigation.chartAnalysis",
    url: createPageUrl("ChartAnalysis"),
    icon: BarChart3,
  },
  {
    titleKey: "navigation.aiAssistant",
    url: createPageUrl("AITutor"),
    icon: MessageSquare,
  },
  {
    titleKey: "navigation.analysisHistory",
    url: createPageUrl("History"),
    icon: History,
  },
];

export default function Layout({ children, currentPageName }) {
  const { t } = useTranslation(['dashboard', 'common', 'landing']);
  const location = useLocation();
  const navigate = useNavigate();
  const { addCreditPackage, openCart } = useCart();
  const [user, setUser] = useState(null);
  const isPublicRoute = location.pathname === "/" || location.pathname === "/login" || location.pathname === "/signup" || location.pathname === "/brand-login" || location.pathname === "/reseller-login" || location.pathname === "/pricing" || location.pathname === "/checkout" || currentPageName === 'Login' || currentPageName === 'BrandLogin' || currentPageName === 'ResellerLogin';
  const [loading, setLoading] = useState(!isPublicRoute);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [quickStats, setQuickStats] = useState({ analyses: 0, accuracyPct: 0 });
  const [analysesToday, setAnalysesToday] = useState(0);
  const TIER_LIMITS = { starter: 10, pro: 50, expert: Infinity };
  const [creditPackages, setCreditPackages] = useState(fallbackCreditPackages);

  useEffect(() => {
    const fetchCreditPackages = async () => {
      try {
        const data = await serverApi.packages.listPublic();
        if (data.creditPackages && data.creditPackages.length > 0) {
          // Convert price strings to numbers for .toFixed() compatibility
          const normalizedCreditPackages = data.creditPackages.map(pkg => ({
            ...pkg,
            price: Number(pkg.price),
            credits: pkg.credits === 'unlimited' || pkg.credits === null ? 'unlimited' : Number(pkg.credits),
            unlimited: pkg.credits === 'unlimited' || pkg.credits === null
          }));
          setCreditPackages(normalizedCreditPackages);
        }
      } catch (error) {
        console.error('Failed to fetch credit packages, using fallback:', error);
      }
    };
    fetchCreditPackages();
  }, []);

  const formatPrice = (price, currency = '$') => `${currency}${Number(price).toFixed(2)}`;
  const sortedCreditPackages = [...creditPackages]
    .sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
  const handleQuickAddCredits = (creditPackage) => {
    addCreditPackage(creditPackage);
    openCart();
  };

  const clearAllCookies = () => {
    try {
      if (typeof document === 'undefined') return;
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = (eqPos > -1 ? cookie.substr(0, eqPos) : cookie).trim();
        if (!name) continue;
        // Clear cookie for current path and root path
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        // Attempt clearing across parent domains
        try {
          const parts = window.location.hostname.split('.');
          while (parts.length > 1) {
            const domain = `.${parts.join('.')}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
            parts.shift();
          }
        } catch (_e) {}
      }
    } catch (_e) {}
  };

  const handleLogout = async () => {
    try { await User.logout(); } catch (_e) {}
    clearAllCookies();
    setUser(null);
    navigate('/');
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        // Load quick stats once user is confirmed
        try {
          const serverAnalyses = await ChartAnalysisEntity.listAnalyses(200);
          const analysesCount = Array.isArray(serverAnalyses) ? serverAnalyses.length : 0;
          const completedAnalyses = Array.isArray(serverAnalyses) ? serverAnalyses : [];
          const highConfidenceCount = completedAnalyses.filter(a => a?.analysis_json?.confidence_level > 0.7).length;
          const successRate = completedAnalyses.length > 0 ? Math.round((highConfidenceCount / completedAnalyses.length) * 100) : 0;
          setQuickStats({ analyses: analysesCount, accuracyPct: successRate });
          try {
            const today = new Date();
            const todayCount = completedAnalyses.filter(a => {
              try { return new Date(a.created_at).toDateString() === today.toDateString() } catch (_e) { return false }
            }).length;
            setAnalysesToday(todayCount);
          } catch (_e) {}
        } catch (_e) {
          // Silently ignore quick stats errors in layout
        }
        if (location.pathname === '/login' || location.pathname === '/brand-login') {
          // If already on login page and authenticated, redirect based on role
          if (currentUser.role === 'brand') {
            navigate('/brand-dashboard');
          } else {
            navigate('/dashboard');
          }
        }
      } catch (e) {
        setUser(null);
        // if (!isPublicRoute) {
        //   navigate('/login');
        // }
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [location.pathname]);

  if (loading && !isPublicRoute) {
    return <div className="w-screen h-screen flex items-center justify-center bg-slate-50">{t('loading', { ns: 'common' })}</div>;
  }

  if (!user && (location.pathname === "/" || currentPageName === 'Login' || currentPageName === 'BrandLogin' || currentPageName === 'ResellerLogin' || location.pathname === '/login' || location.pathname === '/brand-login' || location.pathname === '/reseller-login' || location.pathname === '/pricing' || location.pathname === '/checkout')) {
    return children;
  }

  if ((currentPageName === 'Login' || currentPageName === 'BrandLogin' || currentPageName === 'ResellerLogin') && !user) {
    return children;
  }

  // Always hide the sidebar on the public landing page, even for authenticated users
  if (location.pathname === "/") {
    return children;
  }

  // Bypass app chrome completely on Admin Dashboard and Brand Dashboard routes to match pixel-perfect UI
  const pathLower = (location.pathname || '').toLowerCase();
  if (currentPageName === 'AdminDashboard' || pathLower === '/admin-dashboard' || pathLower.startsWith('/admin-dashboard/')) {
    return children;
  }
  if (currentPageName === 'BrandDashboard' || pathLower === '/brand-dashboard' || pathLower.startsWith('/brand-dashboard/')) {
    return children;
  }

  const allNavItems = navigationItems; // Exclude Admin from sidebar; show access in header instead

  return (
    <SidebarProvider>
      <style>
        {`
          :root {
            --background: 240 10% 98%; /* Lighter, almost white */
            --foreground: 240 5% 10%; /* Dark gray for text */
            
            --primary: 25 95% 53%; /* Orange */
            --primary-foreground: 0 0% 100%; /* White */
            
            --secondary: 240 5% 92%;
            --secondary-foreground: 240 5% 10%;
            
            --muted: 240 5% 92%;
            --muted-foreground: 240 4% 46%;

            --accent: 25 95% 94%;
            --accent-foreground: 25 95% 30%;

            --card: 0 0% 100%;
            --card-foreground: 240 5% 10%;
            
            --border: 240 5% 85%;
            --input: 240 5% 85%;
            --ring: 25 95% 53%;
          }
          
          .glass-effect {
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(251, 146, 60, 0.2);
          }
          
          .gradient-text {
            background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .premium-gradient {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          }
        `}
      </style>
      <div className="min-h-screen flex w-full bg-slate-100">
        <Sidebar className="border-r border-orange-200/50 bg-white">
          <SidebarHeader className="border-b border-orange-200/50 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg gradient-text">OpenSightAI</h2>
                <p className="text-xs text-slate-500 font-medium">{t('navigation.platformSubtitle', { ns: 'dashboard' })}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-3 py-3">
                {t('navigation.menu', { ns: 'dashboard' })}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2">
                  {allNavItems.map((item) => (
                    <SidebarMenuItem key={item.titleKey}>
                      <SidebarMenuButton
                        asChild
                        className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                          (location.pathname.replace(/-/g, '') === item.url.replace(/-/g, ''))
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg'
                          : 'hover:bg-orange-50/70 hover:shadow-md text-slate-700'
                          }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{t(item.titleKey, { ns: 'dashboard' })}</span>
                          {(location.pathname.replace(/-/g, '') === item.url.replace(/-/g, '')) && (
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-orange-500/20 rounded-xl" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-3 py-3">
                {t('navigation.quickStats', { ns: 'dashboard' })}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-3 py-2 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t('navigation.analyses', { ns: 'dashboard' })}</span>
                    <span className="font-bold text-blue-600">{quickStats.analyses}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t('navigation.accuracy', { ns: 'dashboard' })}</span>
                    <span className="font-bold text-orange-600">{quickStats.accuracyPct}%</span>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-orange-200/50 p-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50">
              <div className="w-10 h-10 premium-gradient rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">{user?.full_name?.[0].toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500 truncate capitalize">
                  {user?.subscription_tier || t('navigation.noPackage', { ns: 'dashboard' })} {t('navigation.package', { ns: 'dashboard' })}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => navigate('/pricing')}>
                    <CreditCard className="w-4 h-4" />
                    <span>{t('navigation.billingSettings', { ns: 'dashboard' })}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsCreditsOpen(true)}>
                    <Coins className="w-4 h-4" />
                    <span>{t('navigation.creditsPanel', { ns: 'dashboard' })}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="w-4 h-4" />
                    <span>{t('logout', { ns: 'common' })}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Dialog open={isCreditsOpen} onOpenChange={setIsCreditsOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('creditsPanel.title', { ns: 'dashboard' })}</DialogTitle>
                  <DialogDescription>
                    {t('creditsPanel.dialogDescription', { ns: 'dashboard' })}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">{t('creditsPanel.currentPlan', { ns: 'dashboard' })}</span>
                    <span className="font-semibold capitalize">{user?.subscription_tier || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">{t('creditsPanel.title', { ns: 'dashboard' })}</span>
                    <span className="font-semibold">
                      {user?.credits_unlimited ? t('creditsPanel.unlimited', { ns: 'dashboard' }) : t('creditsPanel.remaining', { count: Number(user?.credits_balance || 0), ns: 'dashboard' })}
                    </span>
                  </div>
                  <div className="pt-2 text-xs text-slate-500">
                    {t('creditsPanel.manageBilling', { ns: 'dashboard' })}
                  </div>
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-600 mb-2">{t('creditsPanel.quickBuy', { ns: 'dashboard' })}</div>
                    <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                      {sortedCreditPackages.map((pkg) => (
                        <div key={pkg.id} className="border rounded-lg p-3 bg-white/70 hover:bg-white transition">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">{pkg.name}</div>
                              <div className="text-xs text-slate-500">{pkg.unlimited ? t('creditsPanel.unlimited', { ns: 'dashboard' }) : t('creditsPanel.creditsCount', { count: pkg.credits, ns: 'dashboard' })}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-orange-600 font-bold">{formatPrice(pkg.price, pkg.currency)}</div>
                              <Button size="sm" className="mt-2" onClick={(e) => { e.preventDefault(); handleQuickAddCredits(pkg); }}>
                                {t('creditsPanel.add', { ns: 'dashboard' })}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Button className="w-full premium-gradient" onClick={() => { setIsCreditsOpen(false); navigate('/pricing'); }}>
                      {t('creditsPanel.buyCreditsUpgrade', { ns: 'dashboard' })}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-orange-200/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-orange-50 p-2 rounded-lg transition-colors duration-200" />
                <h1 className="text-xl font-bold gradient-text">OpenSightAI</h1>
              </div>
              <div className="flex items-center gap-3">
                {(user?.user_type === 'admin' || user?.role === 'admin') && (
                  <Button onClick={() => navigate('/admin-dashboard')} variant="default" className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Shield className="w-4 h-4 mr-2" /> {t('navigation.adminPanel', { ns: 'dashboard' })}
                  </Button>
                )}
                <CurrencySelector />
                <CartIcon />
                <p className="text-sm font-semibold capitalize hidden sm:block">{user?.subscription_tier} {t('navigation.plan', { ns: 'dashboard' })}</p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
          <div className="mt-6 text-center text-gray-400 text-sm">
            <p>The Seacus Company LTD</p>
            <p>It is registered as a legal entity under the Civil & Commercial code</p>
            <p>At the Business Registration office, Samut Prakan Province</p>
            <p>Company registration number: 0115569002129</p>
            <p></p>
          </div>
          <footer className="border-t border-orange-200/50 bg-white/80 text-xs text-slate-600 px-6 py-3 text-center">
            {t('footer.disclaimer', { ns: 'landing' })}
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}

