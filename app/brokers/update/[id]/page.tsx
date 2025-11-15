"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AuthProvider } from "@/components/auth-provider";

interface BrokerLandRecord {
  id: string;
  land_record_id: string;
  last_offer: number | null;
  next_update: string | null;
  status: string;
  land_records: {
    id: string;
    district: string;
    taluka: string;
    village: string;
    area_value: number;
    area_unit: string;
    block_no: string | null;
    re_survey_no: string | null;
  };
}

interface BrokerData {
  id: string;
  name: string;
  phone_number: string;
  area: string;
  rating: number | null;
  status: string;
  recent_task: string;
  remarks: string;
  residence: string;
  connected_by: string;
  connected_by_other: string;
}

export default function BrokerUpdatePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const landId = searchParams?.get("land");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [brokerData, setBrokerData] = useState<BrokerData>({
    id: "",
    name: "",
    phone_number: "",
    area: "",
    rating: null,
    status: "active",
    recent_task: "",
    remarks: "",
    residence: "",
    connected_by: "",
    connected_by_other: "",
  });
  
  const [landRecords, setLandRecords] = useState<BrokerLandRecord[]>([]);

  useEffect(() => {
    fetchBrokerData();
  }, [resolvedParams.id]);

  const fetchBrokerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: broker, error: brokerError } = await supabase
        .from("brokers")
        .select("*")
        .eq("id", resolvedParams.id)
        .single();

      if (brokerError) throw brokerError;
      setBrokerData({
        ...broker,
        name: broker.name || "",
        phone_number: broker.phone_number || "",
        area: broker.area || "",
        status: broker.status || "active",
        recent_task: broker.recent_task || "",
        remarks: broker.remarks || "",
        residence: broker.residence || "",
        connected_by: broker.connected_by || "",
        connected_by_other: broker.connected_by_other || "",
      });

      const { data: lands, error: landsError } = await supabase
        .from("broker_land_records")
        .select(`
          id,
          land_record_id,
          last_offer,
          next_update,
          status,
          land_records!inner (
            id,
            district,
            taluka,
            village,
            area_value,
            area_unit,
            block_no,
            re_survey_no
          )
        `)
        .eq("broker_id", resolvedParams.id);

      if (landsError) throw landsError;

      // Filter by landId if provided in searchParams
      const filteredLands = landId 
        ? (lands || []).filter(land => land.land_record_id === landId)
        : (lands || []);

      setLandRecords(filteredLands as BrokerLandRecord[]);
    } catch (err) {
      console.error("Error fetching broker data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch broker data");
    } finally {
      setLoading(false);
    }
  };

  const handleBrokerChange = (field: string, value: any) => {
    setBrokerData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Clear connected_by_other when changing connected_by to non-Other value
      if (field === "connected_by" && value !== "Other") {
        updated.connected_by_other = "";
      }
      
      return updated;
    });
  };

  const handleLandChange = (landId: string, field: string, value: any) => {
    setLandRecords((prev) =>
      prev.map((land) =>
        land.id === landId ? { ...land, [field]: value } : land
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { error: brokerError } = await supabase
        .from("brokers")
        .update({
          name: brokerData.name,
          phone_number: brokerData.phone_number,
          area: brokerData.area,
          rating: brokerData.rating,
          status: brokerData.status,
          recent_task: brokerData.recent_task,
          remarks: brokerData.remarks,
          residence: brokerData.residence,
          connected_by: brokerData.connected_by && brokerData.connected_by !== "none" ? brokerData.connected_by : null,
          connected_by_other: brokerData.connected_by === "Other" ? brokerData.connected_by_other : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", resolvedParams.id);

      if (brokerError) throw brokerError;

      for (const land of landRecords) {
        const { error: landError } = await supabase
          .from("broker_land_records")
          .update({
            last_offer: land.last_offer,
            next_update: land.next_update,
            status: land.status,
          })
          .eq("id", land.id);

        if (landError) throw landError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving broker data:", err);
      setError(err instanceof Error ? err.message : "Failed to save broker data");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-muted-foreground">Loading broker data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !brokerData.id) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 text-sm sm:text-base mb-4">
              Error loading broker: {error}
            </p>
            <Button onClick={() => router.push("/brokers")} variant="outline">
              Back to Brokers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthProvider>
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/brokers")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Update Broker
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Edit broker information and land assignments
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {success && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="flex items-center gap-2 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-green-700 font-medium">
              Broker information updated successfully!
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700 font-medium">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Broker Information</CardTitle>
          <CardDescription>
            Update basic broker details and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={brokerData.name}
                onChange={(e) => handleBrokerChange("name", e.target.value)}
                placeholder="Enter broker name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number *</Label>
              <Input
                id="phone_number"
                value={brokerData.phone_number}
                onChange={(e) => handleBrokerChange("phone_number", e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                value={brokerData.area}
                onChange={(e) => handleBrokerChange("area", e.target.value)}
                placeholder="Enter area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Input
                id="rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={brokerData.rating || ""}
                onChange={(e) => handleBrokerChange("rating", parseFloat(e.target.value) || null)}
                placeholder="0.0 - 5.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="residence">Residence</Label>
              <Input
                id="residence"
                value={brokerData.residence}
                onChange={(e) => handleBrokerChange("residence", e.target.value)}
                placeholder="Enter residence"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={brokerData.status}
                onValueChange={(value) => handleBrokerChange("status", value)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="connected_by">Connected By</Label>
              <Select
                value={brokerData.connected_by || "none"}
                onValueChange={(value) => handleBrokerChange("connected_by", value === "none" ? "" : value)}
              >
                <SelectTrigger id="connected_by">
                  <SelectValue placeholder="Select connection method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not selected</SelectItem>
                  <SelectItem value="Paper Advertising">Paper Advertising</SelectItem>
                  <SelectItem value="Reff Person">Reff Person</SelectItem>
                  <SelectItem value="Whatsapp Group">Whatsapp Group</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {brokerData.connected_by === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="connected_by_other">Please Specify *</Label>
                <Input
                  id="connected_by_other"
                  value={brokerData.connected_by_other}
                  onChange={(e) => handleBrokerChange("connected_by_other", e.target.value)}
                  placeholder="Enter connection method"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recent_task">Recent Task</Label>
            <Textarea
              id="recent_task"
              value={brokerData.recent_task}
              onChange={(e) => handleBrokerChange("recent_task", e.target.value)}
              placeholder="Enter recent task or update"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={brokerData.remarks}
              onChange={(e) => handleBrokerChange("remarks", e.target.value)}
              placeholder="Enter any additional remarks"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {landId ? "Selected Land Assignment" : `Assigned Lands (${landRecords.length})`}
          </CardTitle>
          <CardDescription>
            {landId 
              ? "View and update information for the selected land assignment"
              : "View and Update information for each land assignment"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {landRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              No lands assigned to this broker
            </p>
          ) : (
            landRecords.map((land, index) => (
              <Card 
                key={land.id} 
                className={`p-4 ${landId && land.land_record_id === landId ? 'border-2 border-blue-500 bg-blue-50' : ''}`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-base">
                        {landId && land.land_record_id === landId 
                          ? "Selected Land Details" 
                          : `Land ${index + 1}`
                        }
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {land.land_records.district} • {land.land_records.village}
                      </p>
                    </div>
                    <Badge variant="outline">{land.status}</Badge>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">District</Label>
                      <p className="text-sm font-medium">{land.land_records.district}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Taluka</Label>
                      <p className="text-sm font-medium">{land.land_records.taluka}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Village</Label>
                      <p className="text-sm font-medium">{land.land_records.village}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Area</Label>
                      <p className="text-sm font-medium">
                        {land.land_records.area_value} {land.land_records.area_unit}
                      </p>
                    </div>

                    {land.land_records.block_no && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Block No</Label>
                        <p className="text-sm font-medium">{land.land_records.block_no}</p>
                      </div>
                    )}

                    {land.land_records.re_survey_no && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Re-Survey No</Label>
                        <p className="text-sm font-medium">{land.land_records.re_survey_no}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`last_offer_${land.id}`}>Last Offer (₹)</Label>
                      <Input
                        id={`last_offer_${land.id}`}
                        type="number"
                        min="0"
                        step="1000"
                        value={land.last_offer || ""}
                        onChange={(e) =>
                          handleLandChange(
                            land.id,
                            "last_offer",
                            parseFloat(e.target.value) || null
                          )
                        }
                        placeholder="Enter amount"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`next_update_${land.id}`}>Next Update</Label>
                      <Input
                        id={`next_update_${land.id}`}
                        type="date"
                        value={land.next_update || ""}
                        onChange={(e) =>
                          handleLandChange(land.id, "next_update", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`status_${land.id}`}>Status</Label>
                      <Select
                        value={land.status}
                        onValueChange={(value) =>
                          handleLandChange(land.id, "status", value)
                        }
                      >
                        <SelectTrigger id={`status_${land.id}`}>
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
                  </div>
                </div>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/brokers")}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
    </AuthProvider>
  );
}