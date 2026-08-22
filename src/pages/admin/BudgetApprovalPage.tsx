import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";

type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

interface BudgetTransaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const statusConfig: Record<ApprovalStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

export default function BudgetApprovalPage() {
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | "all">("all");
  const [actionDialog, setActionDialog] = useState<{ open: boolean; transaction: BudgetTransaction | null; action: "approved" | "rejected" }>({
    open: false,
    transaction: null,
    action: "approved",
  });
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["budget-transactions", filterStatus],
    queryFn: async () => {
      let query = supabase.from("budget_transactions").select("*").order("created_at", { ascending: false });
      if (filterStatus !== "all") {
        query = query.eq("approval_status", filterStatus);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as BudgetTransaction[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: "approved" | "rejected"; rejectionReason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("budget_transactions")
        .update({
          approval_status: status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions"] });
      toast({ title: "Action completed successfully" });
      setActionDialog({ open: false, transaction: null, action: "approved" });
      setReason("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAction = () => {
    if (!actionDialog.transaction) return;
    if (actionDialog.action === "rejected" && !reason.trim()) {
      toast({ title: "Rejection reason required", variant: "destructive" });
      return;
    }
    approveMutation.mutate({
      id: actionDialog.transaction.id,
      status: actionDialog.action,
      rejectionReason: reason.trim() || undefined,
    });
  };

  const statusCounts = {
    all: transactions.length,
    draft: transactions.filter((t) => t.approval_status === "draft").length,
    pending: transactions.filter((t) => t.approval_status === "pending").length,
    approved: transactions.filter((t) => t.approval_status === "approved").length,
    rejected: transactions.filter((t) => t.approval_status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Budget Approval</h1>
        <p className="text-muted-foreground">Review and approve budget transactions</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "draft", "pending", "approved", "rejected"] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <Badge variant="secondary" className="ml-2">{statusCounts[status]}</Badge>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const config = statusConfig[tx.approval_status];
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell>{tx.category}</TableCell>
                      <TableCell className="text-right">{tx.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>
                          <config.icon className="mr-1 h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {tx.approval_status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setActionDialog({ open: true, transaction: tx, action: "approved" })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setActionDialog({ open: true, transaction: tx, action: "rejected" })}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {tx.approval_status === "rejected" && tx.rejection_reason && (
                          <p className="text-xs text-destructive max-w-[200px] truncate">{tx.rejection_reason}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "approved" ? "Approve Transaction" : "Reject Transaction"}
            </DialogTitle>
          </DialogHeader>
          {actionDialog.action === "rejected" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Please provide a reason for rejection:</p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter rejection reason..."
              />
            </div>
          )}
          {actionDialog.action === "approved" && (
            <p className="text-sm text-muted-foreground">Are you sure you want to approve this transaction?</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, transaction: null, action: "approved" })}>
              Cancel
            </Button>
            <Button
              variant={actionDialog.action === "approved" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Processing..." : actionDialog.action === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
