import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, ExternalLink, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Creator {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  cover_image_url: string;
  goal_amount: number;
  current_amount: number;
  socials: any;
  subscription_status: string;
  subscription_expires_at: string;
}

const UserProfile = () => {
  const { username } = useParams();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const fetchCreator = async () => {
      if (!username) return;

      // Fetch creator profile
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('role', 'creator')
        .single();

      if (user) {
        setCreator(user);

        // Check if subscription is active
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('paid_until, is_active')
          .eq('user_id', user.id)
          .single();

        if (subscription) {
          const today = new Date();
          const paidUntil = new Date(subscription.paid_until);
          setIsActive(subscription.is_active && paidUntil >= today);
        }
      }
      setLoading(false);
    };

    fetchCreator();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Creator Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The creator profile you're looking for doesn't exist.
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Profile Inactive</h1>
          <p className="text-muted-foreground mb-4">
            This creator's subscription has expired. They need to renew their subscription to accept donations.
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = creator.goal_amount > 0 
    ? Math.min((Number(creator.current_amount) / Number(creator.goal_amount)) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary fill-primary" />
            <span className="text-xl font-bold">TipKoro</span>
          </Link>
        </div>
      </header>

      {/* Cover Image */}
      {creator.cover_image_url && (
        <div className="h-48 md:h-64 bg-gradient-to-r from-primary/20 to-accent">
          <img 
            src={creator.cover_image_url} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="flex-shrink-0">
              <Avatar className="h-24 w-24 md:h-32 md:w-32">
                <AvatarImage src={creator.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {creator.display_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-grow">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{creator.display_name}</h1>
                  <p className="text-muted-foreground">@{creator.username}</p>
                </div>
                <Link to={`/d/${creator.username}`}>
                  <Button size="lg" className="mt-4 md:mt-0">
                    <Heart className="h-4 w-4 mr-2" />
                    Support Creator
                  </Button>
                </Link>
              </div>

              {creator.bio && (
                <p className="text-foreground mb-4 leading-relaxed">{creator.bio}</p>
              )}

              {/* Social Links */}
              {creator.socials && Object.keys(creator.socials).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(creator.socials).map(([platform, url]) => (
                    <Badge key={platform} variant="outline" className="px-3 py-1">
                      <a 
                        href={url as string} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        {platform}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Progress Card */}
          {creator.goal_amount > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Support Progress</CardTitle>
                <CardDescription>
                  Help {creator.display_name} reach their goal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Raised: {creator.current_amount} BDT</span>
                    <span>Goal: {creator.goal_amount} BDT</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div 
                      className="bg-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {progressPercent.toFixed(1)}% of goal reached
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Support CTA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Support {creator.display_name}</CardTitle>
              <CardDescription className="text-center">
                Your support helps creators continue their amazing work
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link to={`/d/${creator.username}`}>
                <Button size="lg" className="px-12">
                  <Heart className="h-5 w-5 mr-2" />
                  Make a Donation
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-4">
                Minimum donation: 10 BDT • Secure payment via RupantorPay
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;