import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  ExternalLink,
  Settings,
  LogOut
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  current_amount: number;
  goal_amount: number;
  role: string;
}

interface Subscription {
  paid_until: string;
  is_active: boolean;
  last_payment_txn_id: string;
}

interface DonationSummary {
  total_donations: number;
  total_amount: number;
  recent_donations: Array<{
    id: string;
    amount: number;
    donor_name: string;
    message: string;
    is_anonymous: boolean;
    created_at: string;
  }>;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [donations, setDonations] = useState<DonationSummary>({
    total_donations: 0,
    total_amount: 0,
    recent_donations: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch user profile
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
        }

        // Fetch subscription info (for creators)
        if (profileData?.role === 'creator') {
          const { data: subscriptionData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (subscriptionData) {
            setSubscription(subscriptionData);
          }

          // Fetch donation summary
          const { data: donationData } = await supabase
            .from('donations')
            .select('*')
            .eq('creator_id', user.id)
            .eq('payment_status', 'completed')
            .order('created_at', { ascending: false });

          if (donationData) {
            const totalAmount = donationData.reduce((sum, d) => sum + Number(d.amount), 0);
            setDonations({
              total_donations: donationData.length,
              total_amount: totalAmount,
              recent_donations: donationData.slice(0, 5)
            });
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-muted-foreground">Unable to load your profile data.</p>
        </div>
      </div>
    );
  }

  const isSubscriptionActive = subscription && 
    subscription.is_active && 
    new Date(subscription.paid_until) >= new Date();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-primary fill-primary" />
              <span className="text-xl font-bold">TipKoro</span>
            </Link>
            
            <div className="flex items-center gap-4">
              {profile.role === 'creator' && (
                <Link to={`/u/${profile.username}`} target="_blank">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Public Profile
                  </Button>
                </Link>
              )}
              
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {profile.display_name}!
            </h1>
            <p className="text-muted-foreground">
              {profile.role === 'creator' 
                ? 'Manage your creator profile and track your support'
                : 'View your donation history and account settings'
              }
            </p>
          </div>

          {profile.role === 'creator' && (
            <>
              {/* Subscription Status Alert */}
              {!isSubscriptionActive && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold text-destructive">Subscription Required</h3>
                  </div>
                  <p className="text-sm mb-3">
                    Your subscription has expired. Pay 100 BDT monthly to reactivate your profile and accept donations.
                  </p>
                  <Button size="sm" onClick={() => navigate('/subscription')}>
                    Pay Subscription Fee
                  </Button>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{profile.current_amount} BDT</div>
                    <p className="text-xs text-muted-foreground">
                      Available for withdrawal
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Donations</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{donations.total_donations}</div>
                    <p className="text-xs text-muted-foreground">
                      Lifetime supporters
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{donations.total_amount} BDT</div>
                    <p className="text-xs text-muted-foreground">
                      All time earnings
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Subscription</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <Badge variant={isSubscriptionActive ? "default" : "destructive"}>
                      {isSubscriptionActive ? "Active" : "Expired"}
                    </Badge>
                    {subscription && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Until {new Date(subscription.paid_until).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Donations */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Recent Donations</CardTitle>
                  <CardDescription>
                    Your latest supporters and their messages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {donations.recent_donations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No donations yet. Share your profile to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {donations.recent_donations.map((donation) => (
                        <div
                          key={donation.id}
                          className="flex items-start justify-between p-4 border border-border rounded-lg"
                        >
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">
                                {donation.is_anonymous 
                                  ? "Anonymous Donor" 
                                  : (donation.donor_name || "Anonymous Donor")
                                }
                              </span>
                              <Badge variant="outline">{donation.amount} BDT</Badge>
                            </div>
                            {donation.message && (
                              <p className="text-sm text-muted-foreground italic mb-2">
                                "{donation.message}"
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(donation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {profile.role === 'creator' && (
                  <>
                    <Button className="h-auto py-4" variant="outline" onClick={() => navigate('/profile/edit')}>
                      <div className="text-center">
                        <Settings className="h-6 w-6 mx-auto mb-2" />
                        <div>Edit Profile</div>
                      </div>
                    </Button>
                    
                    <Button className="h-auto py-4" variant="outline" onClick={() => navigate('/withdrawals')}>
                      <div className="text-center">
                        <CreditCard className="h-6 w-6 mx-auto mb-2" />
                        <div>Request Withdrawal</div>
                      </div>
                    </Button>
                    
                    <Button className="h-auto py-4" variant="outline">
                      <div className="text-center">
                        <Heart className="h-6 w-6 mx-auto mb-2" />
                        <div>View All Donations</div>
                      </div>
                    </Button>
                  </>
                )}
                
                {profile.role === 'donator' && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Browse creators and show your support!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;