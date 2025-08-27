import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Heart, ArrowLeft, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Donation {
  id: string;
  amount: number;
  donor_name: string;
  message: string;
  is_anonymous: boolean;
  created_at: string;
  creator: {
    username: string;
    display_name: string;
  };
}

const ThankYou = () => {
  const { txnId } = useParams();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDonation = async () => {
      if (!txnId) return;

      const { data } = await supabase
        .from('donations')
        .select(`
          id,
          amount,
          donor_name,
          message,
          is_anonymous,
          created_at,
          users:creator_id (
            username,
            display_name
          )
        `)
        .eq('txn_id', txnId)
        .single();

      if (data) {
        setDonation({
          ...data,
          creator: data.users as any
        });
      }
      setLoading(false);
    };

    fetchDonation();
  }, [txnId]);

  const handleShare = async () => {
    if (!donation) return;
    
    const shareText = `I just supported ${donation.creator.display_name} on TipKoro! 🎉`;
    const shareUrl = `${window.location.origin}/u/${donation.creator.username}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TipKoro Donation',
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      // You could show a toast here
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading donation details...</p>
        </div>
      </div>
    );
  }

  if (!donation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Donation Not Found</h1>
          <p className="text-muted-foreground mb-4">
            We couldn't find the donation details for this transaction.
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary fill-primary" />
            <span className="text-xl font-bold">TipKoro</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-2">Thank You! 🎉</h1>
            <p className="text-xl text-muted-foreground">
              Your donation was successful
            </p>
          </div>

          {/* Donation Details Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Donation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">
                  {donation.amount} BDT
                </div>
                <p className="text-muted-foreground">
                  donated to <strong>{donation.creator.display_name}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="text-center p-3 bg-accent rounded-lg">
                  <div className="font-semibold">Transaction ID</div>
                  <div className="text-muted-foreground font-mono">{txnId}</div>
                </div>
                <div className="text-center p-3 bg-accent rounded-lg">
                  <div className="font-semibold">Date</div>
                  <div className="text-muted-foreground">
                    {new Date(donation.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {donation.message && (
                <div className="mt-4 p-4 bg-accent rounded-lg">
                  <div className="font-semibold mb-2">Your Message:</div>
                  <p className="text-muted-foreground italic">"{donation.message}"</p>
                </div>
              )}

              {donation.is_anonymous ? (
                <Badge variant="secondary">Anonymous Donation</Badge>
              ) : (
                donation.donor_name && (
                  <div className="text-sm text-muted-foreground">
                    From: {donation.donor_name}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={`/u/${donation.creator.username}`}>
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
            
            <Button onClick={handleShare} className="w-full sm:w-auto">
              <Share2 className="h-4 w-4 mr-2" />
              Share This Support
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-4 bg-accent rounded-lg text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>What happens next?</strong>
            </p>
            <p>
              Your donation has been added to {donation.creator.display_name}'s balance. 
              They can withdraw their earnings anytime through their creator dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;