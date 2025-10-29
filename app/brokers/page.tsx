"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Loader2,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  List,
  Grid,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useUserRole } from "@/contexts/user-context";

interface LandRecord {
  id: string;
  district: string;
  village: string;
  last_offer: number | null;
  status: string;
  block_no: string;   
  re_survey_no: string;
}

interface Broker {
  id: string;
  name: string;
  broker_number: string;
  phone_number: string;
  area: string;
  rating: number;
  status: string;
  recent_task: string;
  remarks: string;
  land_records: LandRecord[];
}

const ITEMS_PER_PAGE = 5;

type ViewMode = "list" | "detailed";

export default function BrokerDashboard() {
  const router = useRouter();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [reviveBrokerId, setReviveBrokerId] = useState<string | null>(null);
  const [reviving, setReviving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { role } = useUserRole();

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: brokersData, error: brokersError } = await supabase
        .from("brokers")
        .select("*")
        .order("created_at", { ascending: false });

      if (brokersError) throw brokersError;

      const { data: brokerLands, error: landsError } = await supabase
        .from("broker_land_records")
        .select(`
          broker_id,
          last_offer,
          status,
          land_records (
            id,
            district,
            village,
            block_no,
            re_survey_no
          )
        `);

      if (landsError) throw landsError;

      const brokersWithLands = brokersData?.map((broker) => ({
        ...broker,
        land_records: brokerLands
          ?.filter((bl) => bl.broker_id === broker.id)
          .map((bl) => ({
            id: bl.land_records.id,
            district: bl.land_records.district,
            village: bl.land_records.village,
            block_no: bl.land_records.block_no,  
            re_survey_no: bl.land_records.re_survey_no,   
            last_offer: bl.last_offer,
            status: bl.status,
          })) || [],
      })) || [];

      setBrokers(brokersWithLands);
    } catch (err) {
      console.error("Error fetching brokers:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch brokers");
    } finally {
      setLoading(false);
    }
  };

  const handleReviveBroker = async () => {
    if (!reviveBrokerId) return;

    try {
      setReviving(true);
      const { error } = await supabase
        .from("brokers")
        .update({ status: "active" })
        .eq("id", reviveBrokerId);

      if (error) throw error;

      await fetchBrokers();
      setReviveBrokerId(null);
    } catch (err) {
      console.error("Error reviving broker:", err);
      alert("Failed to revive broker. Please try again.");
    } finally {
      setReviving(false);
    }
  };

  const filteredBrokers = brokers.filter((broker) => {
    const matchesSearch =
      broker.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      broker.broker_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      broker.phone_number?.includes(searchTerm) ||
      broker.area?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || broker.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredBrokers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBrokers = filteredBrokers.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all";

  if (error) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 text-sm sm:text-base mb-4">
              Error loading brokers: {error}
            </p>
            <Button onClick={fetchBrokers} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Broker Management
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {brokers.length} broker{brokers.length !== 1 ? "s" : ""} onboarded
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-9 px-3"
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === "detailed" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("detailed")}
              className="h-9 px-3"
            >
              <Grid className="h-4 w-4 mr-2" />
              Detailed
            </Button>
          </div>
          <Button
            onClick={fetchBrokers}
            variant="outline"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        {role !== 'reviewer' && (
          <Button
            onClick={() => router.push("/brokers/new")}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Broker
          </Button>
        )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">
            {viewMode === "list" ? "Brokers List" : "Brokers"}
          </CardTitle>
          <CardDescription className="text-sm">
            {viewMode === "list" 
              ? "Quick overview of all brokers in a table format" 
              : "View and manage all registered brokers and their land assignments"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, number, phone, area..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-2 sm:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex-1"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
                    •
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="hidden sm:flex gap-4 items-end">
            <div className="min-w-[200px]">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} size="sm">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="sm:hidden space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-muted-foreground">Loading brokers...</span>
                </div>
              </div>
            ) : paginatedBrokers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  {brokers.length === 0
                    ? "No brokers found. Add your first broker to get started."
                    : "No brokers match your search criteria."}
                </p>
              </div>
            ) : viewMode === "list" ? (
              // List View - Table Format
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Broker Number</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Lands</TableHead>
                        {role !== 'reviewer' && (
                          <TableHead className="text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBrokers.map((broker) => (
                        <TableRow key={broker.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{broker.name}</div>
                              {broker.recent_task && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {broker.recent_task}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{broker.broker_number || "-"}</TableCell>
                          <TableCell>{broker.phone_number}</TableCell>
                          <TableCell>{broker.area || "-"}</TableCell>
                          <TableCell>
                            {broker.rating ? (
                              <div className="flex items-center">
                                <span>⭐ {broker.rating}/5</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                broker.status === "active" ? "default" : "secondary"
                              }
                            >
                              {broker.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {broker.land_records.length} lands
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {role !== 'reviewer' && (
                            <div className="flex justify-end gap-2">
                              {broker.status === "inactive" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReviveBrokerId(broker.id)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Link href={`/brokers/update/${broker.id}`}>
                                <Button variant="outline" size="sm">
                                  Update
                                </Button>
                              </Link>
                            </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              // Detailed View - Original Card Format
              paginatedBrokers.map((broker) => (
                <Card key={broker.id} className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{broker.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {broker.broker_number || "No broker number"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              broker.status === "active" ? "default" : "secondary"
                            }
                            className="ml-2"
                          >
                            {broker.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
                          <span>📞 {broker.phone_number}</span>
                          {broker.area && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>📍 {broker.area}</span>
                            </>
                          )}
                          {broker.rating && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>⭐ {broker.rating}/5</span>
                            </>
                          )}
                        </div>
                      </div>

                      {role !== 'reviewer' && (
                      <div className="flex gap-2">
                        {broker.status === "inactive" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReviveBrokerId(broker.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Revive
                          </Button>
                        )}

                        <Link href={`/brokers/update/${broker.id}`}>
                          <Button variant="outline" size="sm">
                            Update
                          </Button>
                        </Link>
                      </div>
                      )}
                    </div>

                    {broker.recent_task && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Recent Task: </span>
                          {broker.recent_task}
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Assigned Lands ({broker.land_records.length})
                      </h4>
                      {broker.land_records.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No lands assigned
                        </p>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>District</TableHead>
                                  <TableHead>Village</TableHead>
                                  <TableHead>Block No</TableHead>
                                  <TableHead>Re-Survey No</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Last Offer</TableHead>
                                  <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {broker.land_records.map((land) => (
                                  <TableRow key={land.id}>
                                    <TableCell className="font-medium">{land.district}</TableCell>
                                    <TableCell>{land.village}</TableCell>
                                    <TableCell>{land.block_no}</TableCell>
                                    <TableCell>{land.re_survey_no || "-"}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {land.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {land.last_offer ? (
                                        <span className="font-semibold text-green-600">
                                          ₹{land.last_offer.toLocaleString("en-IN")}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Link href={`/brokers/update/${broker.id}?land=${land.id}`}>
                                        <Button variant="ghost" size="sm">
                                          View/Update
                                        </Button>
                                      </Link>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {!loading && filteredBrokers.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {startIndex + 1}-
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredBrokers.length)} of{" "}
                {filteredBrokers.length} brokers
              </p>
              <div className="flex gap-2 justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!reviveBrokerId} onOpenChange={() => setReviveBrokerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revive Broker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reactivate this broker? This will change
              their status from inactive to active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReviveBroker} disabled={reviving}>
              {reviving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Revive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}