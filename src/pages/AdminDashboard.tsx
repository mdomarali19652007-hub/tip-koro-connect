import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, DollarSign, CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCreators: 0,
    totalDonations: 0,
    pendingWithdrawals: 0
  });
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    checkAdminAccess();
  }, [user, navigate]);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    try {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!adminUser) {
        toast({
          title: "Access Denied",
          description: "You don't have admin access",
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      fetchDashboardData();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/dashboard');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const [
        { count: totalUsers },
        { count: totalCreators },
        { count: totalDonations },
        { count: pendingWithdrawals }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
        supabase.from('donations').select('*', { count: 'exact', head: true }).eq('payment_status', 'completed'),
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        totalCreators: totalCreators || 0,
        totalDonations: totalDonations || 0,
        pendingWithdrawals: pendingWithdrawals || 0
      });

      // Fetch withdrawals
      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select(`
          *,
          users (
            username,
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      setWithdrawals(withdrawalsData || []);

      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Withdrawal ${action}d successfully`
      });

      fetchDashboardData();
    } catch (error) {
      console.error(`Error ${action}ing withdrawal:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} withdrawal`,
        variant: "destructive"
      });
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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCreators}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Donations</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDonations}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingWithdrawals}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="withdrawals" className="space-y-4">
            <TabsList>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            <TabsContent value="withdrawals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal Requests</CardTitle>
                  <CardDescription>Manage creator withdrawal requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Creator</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Bank Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((withdrawal: any) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{withdrawal.users?.display_name}</div>
                              <div className="text-sm text-muted-foreground">@{withdrawal.users?.username}</div>
                            </div>
                          </TableCell>
                          <TableCell>{withdrawal.amount} BDT</TableCell>
                          <TableCell className="capitalize">{withdrawal.method}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{withdrawal.bank_name}</div>
                              <div>{withdrawal.bank_account_number}</div>
                              <div>{withdrawal.bank_account_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              withdrawal.status === 'approved' ? 'default' :
                              withdrawal.status === 'rejected' ? 'destructive' : 'secondary'
                            }>
                              {withdrawal.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(withdrawal.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {withdrawal.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleWithdrawal(withdrawal.id, 'approve')}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleWithdrawal(withdrawal.id, 'reject')}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage all users</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.display_name}</div>
                              <div className="text-sm text-muted-foreground">@{user.username}</div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'creator' ? 'default' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.current_amount || 0} BDT</TableCell>
                          <TableCell>
                            <Badge variant={user.subscription_status === 'active' ? 'default' : 'secondary'}>
                              {user.subscription_status || 'inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;