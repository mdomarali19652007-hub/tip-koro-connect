import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, ArrowLeft, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Creator {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

const DonationPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  
  const [formData, setFormData] = useState({
    amount: '',
    donorName: '',
    donorEmail: '',
    message: '',
    isAnonymous: false
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!creator) return;
    
    const amount = parseFloat(formData.amount);
    if (amount < 10) {
      toast({
        title: "Invalid Amount",
        description: "Minimum donation amount is 10 BDT",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Call dummy payment processing edge function
      const { data, error } = await supabase.functions.invoke('process-donation', {
        body: {
          creator_id: creator.id,
          amount: amount,
          donor_name: formData.isAnonymous ? null : formData.donorName || null,
          donor_email: formData.isAnonymous ? null : formData.donorEmail || null,
          message: formData.message || null,
          is_anonymous: formData.isAnonymous
        }
      });

      if (error) throw error;

      // Redirect to RupantorPay payment page
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
      }
    } catch (error) {
      console.error('Donation error:', error);
      toast({
        title: "Donation Failed",
        description: "There was an error processing your donation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!creator || !isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {!creator ? 'Creator Not Found' : 'Profile Inactive'}
          </h1>
          <p className="text-muted-foreground mb-4">
            {!creator 
              ? "The creator you're looking for doesn't exist."
              : "This creator's subscription has expired and cannot accept donations."
            }
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={`/u/${creator.username}`} className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Profile</span>
          </Link>
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary fill-primary" />
            <span className="text-xl font-bold">TipKoro</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Creator Info */}
          <div className="text-center mb-8">
            <Avatar className="h-16 w-16 mx-auto mb-4">
              <AvatarImage src={creator.avatar_url} />
              <AvatarFallback>{creator.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold mb-2">
              Support {creator.display_name}
            </h1>
            <p className="text-muted-foreground">@{creator.username}</p>
          </div>

          {/* Donation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Make a Donation
              </CardTitle>
              <CardDescription>
                Show your support with a secure donation via RupantorPay
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount */}
                <div>
                  <Label htmlFor="amount">Donation Amount (BDT) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="10"
                    step="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="Minimum 10 BDT"
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum donation amount is 10 BDT
                  </p>
                </div>

                {/* Anonymous Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous"
                    checked={formData.isAnonymous}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, isAnonymous: checked as boolean })
                    }
                  />
                  <Label htmlFor="anonymous">Make this donation anonymous</Label>
                </div>

                {/* Donor Info (only if not anonymous) */}
                {!formData.isAnonymous && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="donorName">Your Name (Optional)</Label>
                      <Input
                        id="donorName"
                        value={formData.donorName}
                        onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                        placeholder="Enter your name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="donorEmail">Your Email (Optional)</Label>
                      <Input
                        id="donorEmail"
                        type="email"
                        value={formData.donorEmail}
                        onChange={(e) => setFormData({ ...formData, donorEmail: e.target.value })}
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>
                )}

                {/* Message */}
                <div>
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Leave an encouraging message for the creator..."
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
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
                      Donate {formData.amount ? `${formData.amount} BDT` : ''}
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  Payments are processed securely through RupantorPay. 
                  You will be redirected to complete the payment.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DonationPage;