
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createConnectAccountLink } from '@/lib/stripeService';
import { getStripeMode } from '@/lib/stripeClient';
import type { CompanyProfile } from '@/lib/firestoreService';
import { updateCompanyProfile } from '@/lib/firestoreService';
import { useRole } from '@/context/role-context';

interface StripeConnectFormProps {
  companyProfile: CompanyProfile;
}

export function StripeConnectForm({ companyProfile }: StripeConnectFormProps) {
  const { toast } = useToast();
  const { refetchCompanyProfile } = useRole();
  const [isConnecting, setIsConnecting] = useState(false);
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test');

  useEffect(() => {
    setStripeMode(getStripeMode());
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const accountIdField = stripeMode === 'test' ? 'stripeAccountId_test' : 'stripeAccountId_live';
      const existingAccountId = companyProfile[accountIdField];

      const { url, newAccountId, error } = await createConnectAccountLink(
        companyProfile.name,
        stripeMode,
        existingAccountId
      );

      if (error || !url) {
        throw new Error(error || 'Failed to get Stripe connection URL.');
      }

      if (newAccountId && newAccountId !== existingAccountId) {
        await updateCompanyProfile(companyProfile.id, { [accountIdField]: newAccountId });
        await refetchCompanyProfile(); 
      }

      window.location.href = url;

    } catch (err: any) {
      console.error('Failed to connect Stripe account:', err);
      toast({
        title: 'Connection Failed',
        description: err.message,
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  const accountId = stripeMode === 'test' ? companyProfile.stripeAccountId_test : companyProfile.stripeAccountId_live;
  const isAccountOnboarded = stripeMode === 'test' ? companyProfile.stripeAccountOnboarded_test : companyProfile.stripeAccountOnboarded_live;
  
  const stripeDashboardUrl = `https://dashboard.stripe.com/${stripeMode === 'test' ? 'test/' : ''}accounts/${accountId}`;
  const isContinuingOnboarding = accountId && !isAccountOnboarded;

  return (
    <Card className="w-full max-w-2xl shadow-light">
      <CardHeader>
        <CardTitle className="font-headline">Stripe Integration ({stripeMode} mode)</CardTitle>
        <CardDescription>
          {isAccountOnboarded
            ? `Your account is connected to Stripe in ${stripeMode} mode.`
            : `Connect your Stripe account for ${stripeMode} mode to enable client billing.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isAccountOnboarded ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200">Stripe Account Connected ({stripeMode})</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Account ID: <code className="text-xs">{accountId}</code>
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <a href={stripeDashboardUrl} target="_blank" rel="noopener noreferrer">
                View Stripe Dashboard <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
             {isContinuingOnboarding && (
                <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    <div>
                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">Onboarding Incomplete</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Please complete the Stripe onboarding process to activate your account for billing in {stripeMode} mode.
                        </p>
                    </div>
                </div>
             )}
            <Button onClick={handleConnect} disabled={isConnecting} size="lg">
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.665 9.584l-4.04-1.233L16.299.814h-4.33L8.335 9.584H3.85v4.54h3.69l-1.992 8.244h4.33l4.03-9.52h4.486l2.25-4.63-4.31-.013z" />
                </svg>
              )}
              {isConnecting 
                ? 'Redirecting to Stripe...' 
                : isContinuingOnboarding
                  ? `Continue Onboarding (${stripeMode})`
                  : `Connect with Stripe (${stripeMode})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
