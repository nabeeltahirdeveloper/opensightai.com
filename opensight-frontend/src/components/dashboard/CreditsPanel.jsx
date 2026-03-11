import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCart } from "@/contexts/CartContext";
import { creditPackages as fallbackCreditPackages } from "@/data/packages";
import { serverApi } from '@/api/serverApi';

export default function CreditsPanel({ credits_balance = 0, credits_unlimited = false, subscription_tier = null }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const display = credits_unlimited ? 'Unlimited' : String(Number(credits_balance || 0));
  const tier = subscription_tier ? subscription_tier.charAt(0).toUpperCase() + subscription_tier.slice(1) : 'None';
  const { addCreditPackage } = useCart();
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
    navigate('/checkout');
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-orange-200/50 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Coins className="w-5 h-5 text-orange-500" />
          {t('creditsPanel.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <div className="text-slate-600">{t('creditsPanel.currentPlan')}</div>
            <div className="font-semibold text-slate-900">{tier}</div>
          </div>
          <div className="text-left sm:text-right mt-2 sm:mt-0">
            <div className="text-slate-600">{t('creditsPanel.creditsRemaining')}</div>
            <div className="font-extrabold text-2xl text-orange-600">{display}</div>
          </div>
        </div>
        <div className="text-sm text-slate-500">
          {t('creditsPanel.description')}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700">{t('creditsPanel.quickBuy')}</div>
          <div className="max-h-80 sm:max-h-96 lg:max-h-[28rem] overflow-y-auto pr-1">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {sortedCreditPackages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-3 bg-white/70 hover:bg-white transition h-full">
                  <div className="flex flex-col h-full">
                    <div>
                      <div className="font-semibold text-slate-900">{pkg.name}</div>
                      <div className="text-xs text-slate-500">
                        {pkg.unlimited ? t('creditsPanel.unlimited') : t('creditsPanel.creditsCount', { count: pkg.credits })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-orange-600 font-bold">
                        {formatPrice(pkg.price, pkg.currency)}
                      </div>
                      <Button size="sm" className="w-full sm:w-auto" onClick={(e) => { e.preventDefault(); handleQuickAddCredits(pkg); }}>
                        {t('creditsPanel.add')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-500">{t('creditsPanel.seeAllOptions')}</div>
        </div>
        <Link to={createPageUrl("Pricing")}>
          <Button className="w-full premium-gradient hover:shadow-lg">{t('creditsPanel.buyCreditsUpgrade')}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}


