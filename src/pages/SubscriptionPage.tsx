import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchSubscription();
  }, [user, navigate]);

  const fetchSubscription = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionPayment = async (durationMonths: number = 1) => {
    if (!user) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-creator-subscription', {
        body: {
          duration_months: durationMonths
        }
      });

      if (error) throw error;

      // Redirect to RupantorPay
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
      }
    } catch (error) {
      console.error('Subscription payment error:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing your subscription payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const isActive = subscription && subscription.is_active && new Date(subscription.paid_until) >= new Date();
  const daysRemaining = subscription && subscription.paid_until 
    ? Math.ceil((new Date(subscription.paid_until).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Creator Subscription</h1>
          </div>

          {/* Current Subscription Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Subscription Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={isActive ? 'default' : 'destructive'}>
                      {isActive ? 'Active' : 'Expired'}
                    </Badge>
                  </div>
                  
                  {subscription.paid_until && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Valid Until:</span>
                      <span className="text-sm">
                        {new Date(subscription.paid_until).toLocaleDateString()}
                        {daysRemaining > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({daysRemaining} days remaining)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Fee:</span>
                    <span className="text-sm font-medium">100 BDT</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No active subscription</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Plans */}
          <div className="grid gap-6">
            <Card className="relative">
              <CardHeader>
                <CardTitle>Monthly Subscription</CardTitle>
                <CardDescription>
                  Pay monthly to keep your creator profile active
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">100 BDT</div>
                    <div className="text-sm text-muted-foreground">per month</div>
                  </div>
                  
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Accept donations from supporters
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Custom profile page
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Withdrawal options
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Analytics dashboard
                    </li>
                  </ul>
                  
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => handleSubscriptionPayment(1)}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay 100 BDT - 1 Month
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3 Month Subscription</CardTitle>
                <CardDescription>
                  Save with a quarterly payment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">300 BDT</div>
                    <div className="text-sm text-muted-foreground">for 3 months</div>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    size="lg"
                    variant="outline"
                    onClick={() => handleSubscriptionPayment(3)}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay 300 BDT - 3 Months
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Important Note */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Important:</strong> Your creator profile will be deactivated if subscription expires.
                  Supporters won't be able to donate until you renew your subscription.
                </p>
                <p>
                  All payments are processed securely through RupantorPay.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;