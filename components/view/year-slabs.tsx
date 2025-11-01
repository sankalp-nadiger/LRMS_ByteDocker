"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Eye, FileText } from "lucide-react";
import { useLandRecord } from "@/contexts/land-record-context";
import { useToast } from "@/hooks/use-toast";
import { LandRecordService } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function YearSlabs() {
  const { 
    landBasicInfo,
    recordId,
    currentStep
  } = useLandRecord();
  const { toast } = useToast();
  
  const [yearSlabs, setYearSlabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!recordId) return;
      
      try {
        setLoading(true);
        const { data, error } = await LandRecordService.getYearSlabs(recordId);
        
        if (error) throw error;
        
        if (data) {
          // Sort slabs by start year (newest first)
          const sortedSlabs = [...data].sort((a, b) => b.startYear - a.startYear);
          setYearSlabs(sortedSlabs);
        }
      } catch (error) {
        console.error('Error loading year slabs:', error);
        toast({
          title: "Error loading data",
          description: "Could not load year slabs",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [recordId, toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Year Slabs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!yearSlabs.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Year Slabs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-muted-foreground">No year slabs found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Year Slabs</CardTitle>
        {landBasicInfo && (
          <div className="text-sm text-muted-foreground">
            {landBasicInfo.district}, {landBasicInfo.taluka}, {landBasicInfo.village}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {yearSlabs.map((slab, slabIndex) => (
          <Card key={slab.id} className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Slab {slabIndex + 1}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{slab.startYear || '?'}</span>
                <span>-</span>
                <span>{slab.endYear}</span>
              </div>
            </div>

            {/* Main Slab Info - Only show if no paiky or ekatrikaran entries */}
            {!(slab.paiky && slab.paikyEntries?.length > 0) && !(slab.ekatrikaran && slab.ekatrikaranEntries?.length > 0) && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">S.No Type</Label>
                    <p className="text-base font-semibold">
                      {slab.sNoType === 's_no' ? 'Survey No' : 
                       slab.sNoType === 'block_no' ? 'Block No' : 'Re-Survey No'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Number</Label>
                    <p className="text-base font-semibold">{slab.sNo}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Area</Label>
                    <p className="text-base font-semibold">
                      {slab.area.unit === 'sq_m' 
                        ? `${slab.area.value} sq.m` 
                        : slab.area.unit === 'acre'
                          ? `${slab.area.value} acres`
                          : `${slab.area.value} guntha`}
                    </p>
                  </div>
                </div>

                {/* Document Display */}
                {slab.integrated712 && (
                  <div className="space-y-2 mb-4">
                    <Label className="text-sm font-medium text-muted-foreground">7/12 Document</Label>
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          {slab.integrated712.split('/').pop() || 'Document'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(slab.integrated712, '_blank')}
                        className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-100"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Paiky Section - Only show entry-specific data */}
            {slab.paiky && slab.paikyEntries?.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Paiky Entries ({slab.paikyEntries.length})</h4>
                <div className="space-y-4">
                  {slab.paikyEntries.map((entry, entryIndex) => (
                    <div key={`paiky-${entryIndex}`} className="p-3 border rounded-lg bg-green-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-green-700">Paiky Entry {entryIndex + 1}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">S.No Type</Label>
                          <p className="text-sm font-semibold">
                            {entry.sNoType === 's_no' ? 'Survey No' : 
                             entry.sNoType === 'block_no' ? 'Block No' : 'Re-Survey No'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Number</Label>
                          <p className="text-sm font-semibold">{entry.sNo}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Area</Label>
                          <p className="text-sm font-semibold">
                            {entry.area?.unit === 'sq_m' 
                              ? `${entry.area.value} sq.m` 
                              : entry.area?.unit === 'acre'
                                ? `${entry.area.value} acres`
                                : entry.area?.unit === 'guntha'
                                  ? `${entry.area.value} guntha`
                                  : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {entry.integrated712 && (
                        <div className="mt-3 pt-3 border-t">
                          <Label className="text-sm font-medium text-muted-foreground">Document</Label>
                          <div className="flex items-center gap-3 mt-1">
                            <FileText className="w-4 h-4 text-green-600" />
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => window.open(entry.integrated712, '_blank')}
                              className="p-0 h-auto text-green-600 hover:text-green-800"
                            >
                              View 7/12 Document
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ekatrikaran Section - Only show entry-specific data */}
            {slab.ekatrikaran && slab.ekatrikaranEntries?.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Ekatrikaran Entries ({slab.ekatrikaranEntries.length})</h4>
                <div className="space-y-4">
                  {slab.ekatrikaranEntries.map((entry, entryIndex) => (
                    <div key={`ekatrikaran-${entryIndex}`} className="p-3 border rounded-lg bg-orange-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-orange-700">Ekatrikaran Entry {entryIndex + 1}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">S.No Type</Label>
                          <p className="text-sm font-semibold">
                            {entry.sNoType === 's_no' ? 'Survey No' : 
                             entry.sNoType === 'block_no' ? 'Block No' : 'Re-Survey No'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Number</Label>
                          <p className="text-sm font-semibold">{entry.sNo}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Area</Label>
                          <p className="text-sm font-semibold">
                            {entry.area?.unit === 'sq_m' 
                              ? `${entry.area.value} sq.m` 
                              : entry.area?.unit === 'acre'
                                ? `${entry.area.value} acres`
                                : entry.area?.unit === 'guntha'
                                  ? `${entry.area.value} guntha`
                                  : 'N/A'}
                          </p>
                        </div>
                      </div>
                      {entry.integrated712 && (
                        <div className="mt-3 pt-3 border-t">
                          <Label className="text-sm font-medium text-muted-foreground">Document</Label>
                          <div className="flex items-center gap-3 mt-1">
                            <FileText className="w-4 h-4 text-orange-600" />
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => window.open(entry.integrated712, '_blank')}
                              className="p-0 h-auto text-orange-600 hover:text-orange-800"
                            >
                              View 7/12 Document
                            </Button>
                            </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}