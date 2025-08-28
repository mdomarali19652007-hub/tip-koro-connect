import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface SubscriptionMiddlewareProps {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
}

const SubscriptionMiddleware: React.FC<SubscriptionMiddlewareProps> = ({ 
  children, 
  requiresActiveSubscription = false 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    isActive: boolean;
    paidUntil: string | null;
    user: any;
  } | null>(null);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [location.pathname]);

  const checkSubscriptionStatus = async () => {
    setLoading(true);
    
    try {
      // Extract username from profile/donation URLs
      const profileMatch = location.pathname.match(/^\/u\/([^\/]+)/);
      const donationMatch = location.pathname.match(/^\/d\/([^\/]+)/);
      
      if (!profileMatch && !donationMatch) {
        setLoading(false);
        return;
      }

      const username = profileMatch?.[1] || donationMatch?.[1];
      if (!username) {
        setLoading(false);
        return;
      }

      // Fetch user and subscription status
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('role', 'creator')
        .single();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('paid_until, is_active')
        .eq('user_id', user.id)
        .single();

      const isActive = subscription && 
        subscription.is_active && 
        new Date(subscription.paid_until) >= new Date();

      setSubscriptionStatus({
        isActive: !!isActive,
        paidUntil: subscription?.paid_until || null,
        user
      });
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show subscription expired message for creator profiles/donation pages
  if (subscriptionStatus && !subscriptionStatus.isActive && requiresActiveSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto p-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Creator Profile Inactive</CardTitle>
              <CardDescription>
                This creator's subscription has expired
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>{subscriptionStatus.user.display_name}</strong> (@{subscriptionStatus.user.username})
                </p>
                <Badge variant="destructive">Subscription Expired</Badge>
                
                {subscriptionStatus.paidUntil && (
                  <p className="text-xs text-muted-foreground">
                    Last active until: {new Date(subscriptionStatus.paidUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              <div className="bg-muted p-4 rounded-lg text-sm">
                <p className="text-center text-muted-foreground">
                  This creator cannot accept donations until they renew their subscription.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
                  Back to Home
                </Button>
                <Button className="flex-1" onClick={() => navigate('/auth')}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Become a Creator
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SubscriptionMiddleware;