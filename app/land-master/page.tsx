
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Download, Loader2, Filter, X, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LandRecordService, createActivityLog } from "@/lib/supabase"
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/contexts/user-context";
import { create } from "domain";
import { de } from "date-fns/locale";

interface LandRecord {
  id: string;
  district: string;
  taluka: string;
  village: string;
  block_no: string;
  re_survey_no: string;
  json_uploaded?: boolean;
}

export default function LandMaster() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { role } = useUserRole();
  const [lands, setLands] = useState<LandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [talukaFilter, setTalukaFilter] = useState("all");
  const [villageFilter, setVillageFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [selectedLand, setSelectedLand] = useState<string | null>(null);
  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [brokerFormData, setBrokerFormData] = useState({
    brokerId: '',
    lastOffer: '',
    nextUpdate: '',
    status: 'pending'
  });
  const [linkedBrokers, setLinkedBrokers] = useState([]);
  const [loadingLinkedBrokers, setLoadingLinkedBrokers] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [landToDelete, setLandToDelete] = useState<LandRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Only close if clicking outside the dropdown and button
      if (showAddOptions && !target.closest('.add-land-dropdown-container')) {
        setShowAddOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddOptions]);

// Fetch land records and broker links from Supabase
useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch land records
      const { data: landData, error: landError } = await supabase
        .from('land_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (landError) throw landError;

      // Fetch all broker links
      const { data: brokerLinksData, error: brokerLinksError } = await supabase
        .from('broker_land_records')
        .select(`
          id,
          land_record_id,
          last_offer,
          status,
          brokers (
            id,
            name
          )
        `);

      if (brokerLinksError) throw brokerLinksError;

      setLands(landData || []);
      setLinkedBrokers(brokerLinksData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

  useEffect(() => {
    const fetchBrokers = async () => {
      const { data, error } = await supabase
        .from('brokers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      
      if (!error && data) {
        setBrokers(data);
      }
    };
    
    fetchBrokers();
  }, []);

  // Get unique values for filters
  const districts = [
    "all",
    ...new Set(lands.map((land) => land.district)),
  ];
  const talukas = ["all", ...new Set(lands.map((land) => land.taluka))];
  const villages = ["all", ...new Set(lands.map((land) => land.village))];

  // Filter lands based on search and filters
  const filteredLands = lands.filter((land) => {
    const matchesSearch =
      (land.block_no?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (land.re_survey_no?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (land.district?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (land.taluka?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (land.village?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesDistrict =
      districtFilter === "all" || land.district === districtFilter;
    const matchesTaluka =
      talukaFilter === "all" || land.taluka === talukaFilter;
    const matchesVillage =
      villageFilter === "all" || land.village === villageFilter;

    return matchesSearch && matchesDistrict && matchesTaluka && matchesVillage;
  });

  const handleAddOptionSelect = (option: string) => {
    setShowAddOptions(false);
    if (option === 'manual') {
      router.push("/land-master/forms");
    } else if (option === 'json') {
      router.push("/upload-json");
    }
  };

  const handleRefresh = async () => {
  setLoading(true);
  try {
    // Fetch land records
    const { data: landData, error: landError } = await supabase
      .from('land_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (landError) throw landError;

    // Fetch all broker links
    const { data: brokerLinksData, error: brokerLinksError } = await supabase
      .from('broker_land_records')
      .select(`
        id,
        land_record_id,
        last_offer,
        status,
        brokers (
          id,
          name
        )
      `);

    if (brokerLinksError) throw brokerLinksError;

    setLands(landData || []);
    setLinkedBrokers(brokerLinksData || []);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to refresh data');
  } finally {
    setLoading(false);
  }
};

  const handleCloseBrokerDialog = () => {
  setShowBrokerDialog(false);
  setSelectedLand(null);
  setBrokerFormData({ brokerId: '', lastOffer: '', nextUpdate: '', status: 'pending' });
  
  // Refresh broker links to ensure UI is in sync
  const refreshBrokerLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('broker_land_records')
        .select(`
          id,
          land_record_id,
          last_offer,
          status,
          brokers (
            id,
            name
          )
        `);

      if (!error && data) {
        setLinkedBrokers(data);
      }
    } catch (err) {
      console.error('Error refreshing broker links:', err);
    }
  };
  
  refreshBrokerLinks();
};

const handleLinkBroker = async (landId: string) => {
  if (!isSignedIn) {
    alert("Please sign in to link brokers");
    return;
  }

  setSelectedLand(landId);
  setShowBrokerDialog(true);
  setLoadingLinkedBrokers(true);
  
  try {
    const { data, error } = await supabase
      .from('broker_land_records')
      .select(`
        id,
        last_offer,
        status,
        brokers (
          id,
          name
        )
      `)
      .eq('land_record_id', landId);

    if (error) throw error;
    setLinkedBrokers(data || []);
  } catch (err) {
    console.error('Error fetching linked brokers:', err);
  } finally {
    setLoadingLinkedBrokers(false);
  }
};

const handleUnlinkBroker = async (linkId: string) => {
  if (!isSignedIn) {
    alert("Please sign in to unlink brokers");
    return;
  }

  try {
    // Get broker name before unlinking for activity log
    const brokerToUnlink = linkedBrokers.find(link => link.id === linkId);
    const brokerName = brokerToUnlink?.brokers?.name || 'Unknown Broker';

    const { error } = await supabase
      .from('broker_land_records')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
    
    // Remove from local state
    setLinkedBrokers(linkedBrokers.filter(link => link.id !== linkId));
    
    // Create activity log
    await createActivityLog({
      user_email: user?.primaryEmailAddress?.emailAddress || "",
      land_record_id: selectedLand!,
      step: null,
      chat_id: null,
      description: `Unlinked broker "${brokerName}" from land record`
    });
    
    // Show success message
    toast({
      title: "Broker Unlinked",
      description: "Broker has been successfully unlinked from this land record.",
      variant: "default",
    });
  } catch (err) {
    console.error('Error unlinking broker:', err);
    toast({
      title: "Unlink Failed",
      description: "Failed to unlink broker. Please try again.",
      variant: "destructive",
    });
  }
};

const handleSubmitBrokerLink = async () => {
  if (!isSignedIn) {
    alert("Please sign in to link brokers");
    return;
  }
    
  try {
    // Get broker name for activity log
    const selectedBroker = brokers.find(broker => broker.id === brokerFormData.brokerId);
    const brokerName = selectedBroker?.name || 'Unknown Broker';

    const { error } = await supabase
      .from('broker_land_records')
      .insert({
        broker_id: brokerFormData.brokerId,
        land_record_id: selectedLand,
        last_offer: brokerFormData.lastOffer ? parseFloat(brokerFormData.lastOffer) : null,
        next_update: brokerFormData.nextUpdate || null,
        status: brokerFormData.status
      });

    if (error) throw error;
    
    // Create activity log
    await createActivityLog({
      user_email: user?.primaryEmailAddress?.emailAddress || "",
      land_record_id: selectedLand!,
      step: null,
      chat_id: null,
      description: `Linked broker "${brokerName}" to land record with status: ${brokerFormData.status}${brokerFormData.lastOffer ? ` and last offer: ₹${brokerFormData.lastOffer}` : ''}`
    });
    
    // Refresh all broker links
    const { data, error: fetchError } = await supabase
      .from('broker_land_records')
      .select(`
        id,
        land_record_id,
        last_offer,
        status,
        brokers (
          id,
          name
        )
      `);

    if (fetchError) throw fetchError;
    
    setLinkedBrokers(data || []);
    setShowBrokerDialog(false);
    setBrokerFormData({ brokerId: '', lastOffer: '', nextUpdate: '', status: 'pending' });
    
    toast({
      title: "Broker Linked",
      description: "Broker has been successfully linked to this land record.",
      variant: "default",
    });
  } catch (err) {
    console.error('Error linking broker:', err);
    toast({
      title: "Linking Failed",
      description: "Failed to link broker. Please try again.",
      variant: "destructive",
    });
  }
};

  const clearFilters = () => {
    setSearchTerm("");
    setDistrictFilter("all");
    setTalukaFilter("all");
    setVillageFilter("all");
  };

  const hasActiveFilters = searchTerm || districtFilter !== "all" || talukaFilter !== "all" || villageFilter !== "all";

  const handleDeleteClick = (land: LandRecord) => {
    // Add authentication check
    if (!isSignedIn) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to delete land records",
        variant: "destructive",
      });
      return;
    }
    setLandToDelete(land);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!landToDelete) return;
    
    try {
      setDeleting(true);
      const { error } = await LandRecordService.deleteLandRecord(landToDelete.id);
      
      if (error) {
        throw error;
      }
      
      // Remove the land from local state
      setLands(lands.filter(land => land.id !== landToDelete.id));
      setDeleteConfirmOpen(false);
      setLandToDelete(null);
      
      // Show success toast
      toast({
        title: "Successfully Deleted",
        description: `Land record from ${landToDelete.district} district has been deleted.`,
        variant: "default",
        className: "bg-green-50 text-green-800 border-green-200",
      });
      
    } catch (err) {
      console.error('Error deleting land record:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete land record');
      
      // Show error toast
      toast({
        title: "Deletion Failed",
        description: err instanceof Error ? err.message : 'Failed to delete land record',
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setLandToDelete(null);
  };

  // Export to CSV function
  const exportToCSV = () => {
    if (filteredLands.length === 0) return;
    
    // Create CSV header
    const headers = ["District", "Taluka", "Village", "Block No", "Re-Survey No", "Created At"];
    
    // Create CSV rows
    const rows = filteredLands.map(land => [
      land.district,
      land.taluka,
      land.village,
      land.block_no,
      land.re_survey_no,
      new Date(land.created_at).toLocaleDateString()
    ]);
    
    // Combine header and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `land-records-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Land Master</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage all land records across districts
            </p>
          </div>
  {role !== 'reviewer' && (
    <>
          <div className="relative add-land-dropdown-container">
            <Button onClick={() => setShowAddOptions(!showAddOptions)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add New Land
            </Button>
            
            {showAddOptions && (
              <div 
                className="absolute top-full left-0 mt-1 w-full sm:w-48 bg-white border rounded-md shadow-lg z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleAddOptionSelect('manual')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Add Manually
                </button>
                <button
                  onClick={() => handleAddOptionSelect('json')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Upload via JSON
                </button>
              </div>
            )}
          </div>
          </>
  )}
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <p className="text-red-600 text-sm sm:text-base">Error loading land records: {error}</p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Land Master</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage all land records across districts
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Refresh
          </Button>
          <div className="relative add-land-dropdown-container">
            {role !== 'reviewer' && (
              <Button onClick={() => setShowAddOptions(!showAddOptions)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add New Land
              </Button>
            )}

            {showAddOptions && (
              <div 
                className="absolute top-full left-0 mt-1 w-full sm:w-48 bg-white border rounded-md shadow-lg z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleAddOptionSelect('manual')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Add Manually
                </button>
                <button
                  onClick={() => handleAddOptionSelect('json')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Upload via JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Land Records</CardTitle>
          <CardDescription className="text-sm">
            View and manage all registered land records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile Search and Filter Toggle */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only sm:not-sr-only">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Mobile Filter Toggle */}
            <div className="flex gap-2 sm:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex-1"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters {hasActiveFilters && <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">•</span>}
              </Button>
              <Button 
                variant="outline" 
                disabled={loading || filteredLands.length === 0} 
                size="sm"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Desktop Filters - Always Visible */}
          <div className="hidden sm:flex flex-wrap gap-4">
            <div className="min-w-[150px] flex-1">
              <Label>District</Label>
              <Select 
                value={districtFilter} 
                onValueChange={setDistrictFilter}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.slice(1).map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px] flex-1">
              <Label>Taluka</Label>
              <Select 
                value={talukaFilter} 
                onValueChange={setTalukaFilter}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Talukas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Talukas</SelectItem>
                  {talukas.slice(1).map((taluka) => (
                    <SelectItem key={taluka} value={taluka}>
                      {taluka}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px] flex-1">
              <Label>Village</Label>
              <Select 
                value={villageFilter} 
                onValueChange={setVillageFilter}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Villages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Villages</SelectItem>
                  {villages.slice(1).map((village) => (
                    <SelectItem key={village} value={village}>
                      {village}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <Button 
                variant="outline" 
                disabled={loading || filteredLands.length === 0}
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Mobile Filters - Collapsible */}
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
              
              <div className="space-y-3">
                <div>
                  <Label>District</Label>
                  <Select 
                    value={districtFilter} 
                    onValueChange={setDistrictFilter}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.slice(1).map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Taluka</Label>
                  <Select 
                    value={talukaFilter} 
                    onValueChange={setTalukaFilter}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Talukas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Talukas</SelectItem>
                      {talukas.slice(1).map((taluka) => (
                        <SelectItem key={taluka} value={taluka}>
                          {taluka}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Village</Label>
                  <Select 
                    value={villageFilter} 
                    onValueChange={setVillageFilter}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Villages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Villages</SelectItem>
                      {villages.slice(1).map((village) => (
                        <SelectItem key={village} value={village}>
                          {village}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Desktop Table */}
<div className="hidden lg:block rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>District</TableHead>
        <TableHead>Taluka</TableHead>
        <TableHead>Village</TableHead>
        <TableHead>Block No</TableHead>
        <TableHead>Re-Survey No</TableHead>
        <TableHead>Actions</TableHead> 
      </TableRow>
    </TableHeader>
    <TableBody>
      {loading ? (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-12">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-muted-foreground">
                Loading land records...
              </span>
            </div>
          </TableCell>
        </TableRow>
      ) : filteredLands.length === 0 ? (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-8">
            <div className="text-muted-foreground">
              {lands.length === 0
                ? "No land records found. Add your first land record to get started."
                : "No records match your search criteria."}
            </div>
          </TableCell>
        </TableRow>
      ) : (
        filteredLands.map((land) => {
          const landLinkedBrokers = linkedBrokers.filter(link => link.land_record_id === land.id);
          const hasLinkedBrokers = landLinkedBrokers.length > 0;
          
          return (
            <TableRow key={land.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {land.district}
                  {land.json_uploaded && (
                    <Badge variant="outline" className="text-xs">JSON Upload</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{land.taluka}</TableCell>
              <TableCell>{land.village}</TableCell>
              <TableCell>{land.block_no}</TableCell>
              <TableCell>{land.re_survey_no}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link href={`/land-master/forms?mode=view&id=${land.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                  {role !== 'reviewer' && (
                    <>
                      <Link href={`/land-master/forms?mode=edit&id=${land.id}`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      {hasLinkedBrokers ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground max-w-[100px] truncate">
                            {landLinkedBrokers[0].brokers.name}
                            {landLinkedBrokers.length > 1 && ` +${landLinkedBrokers.length - 1}`}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleLinkBroker(land.id)}
                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                            title="Manage Brokers"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleLinkBroker(land.id)}
                        >
                          Link Broker
                        </Button>
                      )}
                    </>
                  )}
                  {role !== 'reviewer' && role !== 'executioner' && (
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => handleDeleteClick(land)}
    className="text-red-600 hover:text-red-800 hover:bg-red-50"
  >
    Delete
  </Button>
)}
                </div>
              </TableCell>
            </TableRow>
          );
        })
      )}
    </TableBody>
  </Table>
</div>

{/* Mobile/Tablet Card Layout */}
<div className="lg:hidden space-y-3">
  {loading ? (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-muted-foreground">Loading land records...</span>
      </div>
    </div>
  ) : filteredLands.length === 0 ? (
    <div className="text-center py-8">
      <div className="text-muted-foreground text-sm">
        {lands.length === 0
          ? "No land records found. Add your first land record to get started."
          : "No records match your search criteria."}
      </div>
    </div>
  ) : (
    filteredLands.map((land) => {
      const landLinkedBrokers = linkedBrokers.filter(link => link.land_record_id === land.id);
      const hasLinkedBrokers = landLinkedBrokers.length > 0;
      
      return (
        <Card key={land.id} className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  {land.district}
                  {land.json_uploaded && (
                    <Badge variant="outline" className="text-xs">JSON</Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {land.taluka} • {land.village}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Block No:</span>
                <div className="font-medium">{land.block_no}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Re-Survey No:</span>
                <div className="font-medium">{land.re_survey_no}</div>
              </div>
            </div>

            {/* Broker Info for Mobile */}
            {hasLinkedBrokers && (
              <div className="bg-muted/50 p-2 rounded-md text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Linked Broker:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{landLinkedBrokers[0].brokers.name}</span>
                    {landLinkedBrokers.length > 1 && (
                      <Badge variant="outline" className="text-xs">
                        +{landLinkedBrokers.length - 1}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Link href={`/land-master/forms?mode=view&id=${land.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">View</Button>
              </Link>
              {role !== 'reviewer' && (
                <>
                  <Link href={`/land-master/forms?mode=edit&id=${land.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Edit</Button>
                  </Link>
                  {hasLinkedBrokers ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleLinkBroker(land.id)}
                      title="Manage Brokers"
                    >
                      Brokers
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleLinkBroker(land.id)}
                    >
                      Link Broker
                    </Button>
                  )}
                </>
              )}
              {role !== 'reviewer' && role !== 'executioner' && (
  <Button 
    variant="outline" 
    size="sm" 
    className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
    onClick={() => handleDeleteClick(land)}
  >
    Delete
  </Button>
)}
            </div>
          </div>
        </Card>
      );
    })
  )}
</div>

          {/* Results Summary and Pagination */}
          {!loading && filteredLands.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {filteredLands.length} of {lands.length} records
              </p>
              <div className="flex gap-2 justify-center sm:justify-end">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {showBrokerDialog && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
      <div className="overflow-y-auto max-h-[90vh]">
        <CardHeader>
          <CardTitle>Link Broker</CardTitle>
          <CardDescription>Associate a broker with this land record</CardDescription>
        </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Add New Broker Link */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Add New Broker</h3>
            
            <div>
              <Label>Select Broker</Label>
              <Select
                value={brokerFormData.brokerId}
                onValueChange={(value) => setBrokerFormData({...brokerFormData, brokerId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a broker" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((broker) => (
                    <SelectItem key={broker.id} value={broker.id}>
                      {broker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link href="/brokers/new">
                <Button variant="link" className="pl-0 text-sm" size="sm">
                  + Add New Broker
                </Button>
              </Link>
            </div>

            <div>
              <Label>Last Offer (Optional)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={brokerFormData.lastOffer}
                onChange={(e) => setBrokerFormData({...brokerFormData, lastOffer: e.target.value})}
              />
            </div>

            <div>
              <Label>Next Update Date (Optional)</Label>
              <Input
                type="date"
                value={brokerFormData.nextUpdate}
                onChange={(e) => setBrokerFormData({...brokerFormData, nextUpdate: e.target.value})}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={brokerFormData.status}
                onValueChange={(value) => setBrokerFormData({...brokerFormData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="negotiating">Negotiating</SelectItem>
                  <SelectItem value="deal_closed">Deal Closed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
  variant="outline"
  className="flex-1"
  onClick={handleCloseBrokerDialog}
>
  Cancel
</Button>
              <Button
                className="flex-1"
                onClick={handleSubmitBrokerLink}
                disabled={!brokerFormData.brokerId}
              >
                Link Broker
              </Button>
            </div>
          </div>

          {/* Right Side - Linked Brokers */}
          <div className="space-y-4 border-l pl-6">
  <h3 className="font-semibold text-sm">Linked Brokers ({linkedBrokers.length})</h3>
  
  {loadingLinkedBrokers ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ) : linkedBrokers.length === 0 ? (
    <div className="text-center py-8 text-muted-foreground text-sm">
      No brokers linked yet
    </div>
  ) : (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {linkedBrokers.map((link) => (
        <Card key={link.id} className="p-3">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="font-medium text-sm">{link.brokers.name}</div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={
                    link.status === 'deal_closed' ? 'default' :
                    link.status === 'negotiating' ? 'secondary' :
                    link.status === 'rejected' ? 'destructive' : 'outline'
                  }
                  className="text-xs"
                >
                  {link.status.replace('_', ' ')}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnlinkBroker(link.id)}
                  className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                  title="Unlink Broker"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {link.last_offer && (
              <div className="text-sm">
                <span className="text-muted-foreground">Last Offer:</span>
                <span className="ml-2 font-medium">₹{link.last_offer.toLocaleString()}</span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )}
</div>
        </div>
      </CardContent>
    </div>
    </Card>
  </div>
)}

{/* Delete Confirmation Dialog */}
{deleteConfirmOpen && landToDelete && isSignedIn && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-red-600">Confirm Deletion</CardTitle>
        <CardDescription>
          Are you sure you want to delete this land record? This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <p><strong>District:</strong> {landToDelete.district}</p>
            <p><strong>Taluka:</strong> {landToDelete.taluka}</p>
            <p><strong>Village:</strong> {landToDelete.village}</p>
            <p><strong>Block No:</strong> {landToDelete.block_no}</p>
            <p><strong>Re-Survey No:</strong> {landToDelete.re_survey_no}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all data associated with this land record, 
            including year slabs, panipatraks, nondhs, and broker links.
          </p>
        </div>
      </CardContent>
      <div className="flex gap-2 p-6 pt-0">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleCancelDelete}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={handleConfirmDelete}
          disabled={deleting}
        >
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete Permanently'
          )}
        </Button>
      </div>
    </Card>
  </div>
)}
    </div>
  );
}