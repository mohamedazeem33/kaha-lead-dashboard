import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, RefreshCw, LogOut, Search } from "lucide-react";

type Lead = {
  id: string;
  name: string;
  mobile: string | null;
  city: string | null;
  joining_timeline: string | null;
  stitching_experience: string | null;
  created_at: string | null;
};

const leadsQuery = queryOptions({
  queryKey: ["leads"],
  queryFn: async (): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, mobile, city, joining_timeline, stitching_experience, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

const adminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("role", "admin")
      .maybeSingle();
    if (error) return false;
    return !!data;
  },
});

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Leads Dashboard — Kaha Leads" },
      { name: "description", content: "View and manage incoming leads." },
      { property: "og:title", content: "Leads Dashboard — Kaha Leads" },
      { property: "og:description", content: "View and manage incoming leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(adminQuery),
      context.queryClient.ensureQueryData(leadsQuery),
    ]),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useSuspenseQuery(adminQuery);
  const {
    data: leads,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useSuspenseQuery(leadsQuery);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.mobile, l.city, l.joining_timeline, l.stitching_experience]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = leads.filter(
      (l) => l.created_at && new Date(l.created_at) >= weekAgo
    ).length;
    const cities = new Set(leads.map((l) => l.city).filter(Boolean)).size;
    return { total: leads.length, thisWeek, cities };
  }, [leads]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>No access yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account is signed in, but it hasn't been approved to view
              leads. Ask an admin to grant you access.
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-foreground">Kaha Leads</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                New this week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {stats.thisWeek}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{stats.cities}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {leads.length === 0
                  ? "No leads yet. New submissions will appear here."
                  : "No leads match your search."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Joining timeline</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.name}
                        </TableCell>
                        <TableCell>
                          {lead.mobile ? (
                            <a
                              href={`tel:${lead.mobile}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {lead.mobile}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{lead.city ?? "—"}</TableCell>
                        <TableCell>
                          {lead.joining_timeline ? (
                            <Badge variant="secondary">
                              {lead.joining_timeline}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{lead.stitching_experience ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.created_at
                            ? new Date(lead.created_at).toLocaleDateString(
                                undefined,
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      </main>
    </div>
  );
}
