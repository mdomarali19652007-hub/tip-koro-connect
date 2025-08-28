import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const WithdrawalsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  
  const [formData, setFormData] = useState({
    amount: '',
    method: 'bkash',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user balance
      const { data: userData } = await supabase
        .from('users')
        .select('current_amount')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserBalance(userData.current_amount || 0);
      }

      // Fetch withdrawal history
      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setWithdrawals(withdrawalsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load withdrawal data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseFloat(formData.amount);
    if (amount <= 0 || amount > userBalance) {
      toast({
        title: "Invalid Amount",
        description: `Amount must be between 1 and ${userBalance} BDT`,
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-withdrawal', {
        body: {
          amount,
          method: formData.method,
          bank_name: formData.bank_name,
          bank_account_name: formData.bank_account_name,
          bank_account_number: formData.bank_account_number
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully"
      });

      // Reset form
      setFormData({
        amount: '',
        method: 'bkash',
        bank_name: '',
        bank_account_name: '',
        bank_account_number: ''
      });

      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Withdrawal request error:', error);
      toast({
        title: "Request Failed",
        description: "There was an error submitting your withdrawal request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Withdrawals</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Current Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Available Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">
                  {userBalance.toFixed(2)} BDT
                </div>
                <p className="text-sm text-muted-foreground">
                  Available for withdrawal
                </p>
              </CardContent>
            </Card>

            {/* Withdrawal Request Form */}
            <Card>
              <CardHeader>
                <CardTitle>Request Withdrawal</CardTitle>
                <CardDescription>
                  Submit a withdrawal request to receive your earnings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdrawalRequest} className="space-y-4">
                  <div>
                    <Label htmlFor="amount">Amount (BDT) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      max={userBalance}
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="Enter amount"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum: {userBalance.toFixed(2)} BDT
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="method">Withdrawal Method *</Label>
                    <Select 
                      value={formData.method} 
                      onValueChange={(value) => setFormData({ ...formData, method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bkash">bKash</SelectItem>
                        <SelectItem value="nagad">Nagad</SelectItem>
                        <SelectItem value="rocket">Rocket</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bank_name">Bank/Service Name *</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., bKash, Dutch-Bangla Bank"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank_account_name">Account Holder Name *</Label>
                    <Input
                      id="bank_account_name"
                      value={formData.bank_account_name}
                      onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                      placeholder="Full name as per account"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank_account_number">Account Number *</Label>
                    <Input
                      id="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                      placeholder="Account/mobile number"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={processing || userBalance <= 0}>
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      'Submit Withdrawal Request'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Withdrawal History */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Withdrawal History</CardTitle>
              <CardDescription>
                View all your withdrawal requests and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Bank Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal: any) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">
                          {withdrawal.amount} BDT
                        </TableCell>
                        <TableCell className="capitalize">
                          {withdrawal.method}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{withdrawal.bank_name}</div>
                            <div className="text-muted-foreground">
                              {withdrawal.bank_account_number}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(withdrawal.status)}
                            <Badge variant={getStatusVariant(withdrawal.status)}>
                              {withdrawal.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(withdrawal.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {withdrawal.processed_at 
                            ? new Date(withdrawal.processed_at).toLocaleDateString()
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No withdrawal requests yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalsPage;