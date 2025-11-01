"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Download, Eye, FileText, Trash2 } from "lucide-react"
import { useLandRecord } from "@/contexts/land-record-context"
import { LandRecordService } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { Nondh } from "@/contexts/land-record-context"
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

export default function NondhAdd() {
  const { recordId, yearSlabs, landBasicInfo } = useLandRecord()
  const { toast } = useToast()
  const router = useRouter()
  const [nondhs, setNondhs] = useState<Nondh[]>([])
  const [loading, setLoading] = useState(true)

  // Get all unique S.Nos from slabs and step 1 with their types
  const getAllSNos = useCallback(() => {
    const sNosMap = new Map<string, string>(); // Map<number, type>
    
    // Add S.Nos from year slabs (step 2)
    yearSlabs.forEach((slab) => {
      if (slab.sNo.trim() !== "") {
        sNosMap.set(slab.sNo, slab.sNoType || 'S.No.');
      }
      slab.paikyEntries.forEach((entry) => {
        if (entry.sNo.trim() !== "") {
          sNosMap.set(entry.sNo, entry.sNoType || 'S.No.');
        }
      })
      slab.ekatrikaranEntries.forEach((entry) => {
        if (entry.sNo.trim() !== "") {
          sNosMap.set(entry.sNo, entry.sNoType || 'S.No.');
        }
      })
    })

    // Add unused S.Nos from step 1 (landBasicInfo)
    if (landBasicInfo) {
      // Get all S.Nos currently used in step 2
      const usedSNos = new Set(Array.from(sNosMap.keys()));
      
      // Check Survey Numbers from step 1
      if (landBasicInfo.sNo && landBasicInfo.sNo.trim() !== "") {
        const surveyNos = landBasicInfo.sNo.split(',').map(s => s.trim()).filter(s => s !== "");
        surveyNos.forEach(sNo => {
          if (!usedSNos.has(sNo)) {
            sNosMap.set(sNo, 'S.No.');
          }
        });
      }
      
      // Check Block Number from step 1
      if (landBasicInfo.blockNo && landBasicInfo.blockNo.trim() !== "") {
        if (!usedSNos.has(landBasicInfo.blockNo)) {
          sNosMap.set(landBasicInfo.blockNo, 'Block No.');
        }
      }
      
      // Check Re-survey Number from step 1
      if (landBasicInfo.reSurveyNo && landBasicInfo.reSurveyNo.trim() !== "") {
        if (!usedSNos.has(landBasicInfo.reSurveyNo)) {
          sNosMap.set(landBasicInfo.reSurveyNo, 'Re-survey No.');
        }
      }
    }

    return sNosMap;
  }, [yearSlabs, landBasicInfo])

  // Filter affected S.Nos to show only those that exist in step 1 & step 2
  const getFilteredAffectedSNos = useCallback((affectedSNos: any[]) => {
    const availableSNos = getAllSNos();
    
    return affectedSNos.filter(sNoItem => {
      try {
        let parsed;
        if (typeof sNoItem === 'string') {
          parsed = JSON.parse(sNoItem);
        } else if (typeof sNoItem === 'object' && sNoItem.number) {
          parsed = sNoItem;
        } else {
          return false;
        }
        
        // Check if this S.No exists in available S.Nos
        return availableSNos.has(parsed.number);
      } catch (error) {
        return false;
      }
    });
  }, [getAllSNos])

  // Fetch nondh data
  useEffect(() => {
    const fetchNondhs = async () => {
      if (!recordId) {
        console.log('[NondhAdd] No recordId provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('[NondhAdd] Fetching nondhs for recordId:', recordId);
        const { data, error } = await LandRecordService.getNondhs(recordId);
        
        console.log('[NondhAdd] Received response:', { data, error });

        if (error) throw error;
        
        if (data) {
          console.log('[NondhAdd] Setting nondhs data:', data);
          setNondhs(data);
        }
      } catch (error) {
        console.error('[NondhAdd] Error in fetchNondhs:', error);
        toast({ 
          title: "Error loading nondh data", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    }

    fetchNondhs();
  }, [recordId, toast]);

  const handleFileDownload = (url: string) => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nondh Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading nondh data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!nondhs || nondhs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Nondh Information</CardTitle>
            <Button 
              variant="outline"
              onClick={() => router.push(`/upload-json?fromView=true&landRecordId=${recordId}`)}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload via JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-muted-foreground">No nondh records found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nondh Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {nondhs.map((nondh, index) => {
          const filteredAffectedSNos = getFilteredAffectedSNos(nondh.affectedSNos || []);
          
          return (
            <div key={nondh.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Nondh Number: {nondh.number}</h3>
              </div>

              {/* Affected Survey Numbers */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Affected Survey Numbers
                </Label>
                
                {/* Show filtered S.Nos (from basic info/year slabs) */}
                <div className="flex flex-wrap gap-2">
                  {filteredAffectedSNos.length > 0 ? (
                    filteredAffectedSNos.map((sNoItem, idx) => {
                      try {
                        const parsed = typeof sNoItem === 'string' ? JSON.parse(sNoItem) : sNoItem;
                        const typeDisplay = parsed.type === "s_no" ? "S.No." : 
                                          parsed.type === "block_no" ? "Block No." : 
                                          parsed.type === "re_survey_no" ? "Re-survey No." : "S.No.";
                        return (
                          <span key={`${nondh.id}-${idx}`} className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                            {typeDisplay} {parsed.number}
                          </span>
                        );
                      } catch (error) {
                        return null;
                      }
                    })
                  ) : (
                    <p className="text-sm text-gray-500">No affected survey numbers available from current records</p>
                  )}
                </div>

                {/* Show "Inserted but not part of basic info/year slabs" below the filtered S.Nos */}
                {(() => {
                  // Get all available S.Nos from basic info/year slabs
                  const availableSNos = getAllSNos();
                  
                  // Filter affectedSNos to only include those NOT in availableSNos
                  const insertedButNotInBasicInfo = nondh.affectedSNos.filter(item => {
                    try {
                      let sNoNumber;
                      if (typeof item === 'string') {
                        const parsed = JSON.parse(item);
                        sNoNumber = parsed.number;
                      } else if (typeof item === 'object' && item.number) {
                        sNoNumber = item.number;
                      } else {
                        sNoNumber = item;
                      }
                      return !availableSNos.has(sNoNumber);
                    } catch {
                      return !availableSNos.has(item);
                    }
                  });

                  if (insertedButNotInBasicInfo.length > 0) {
                    return (
                      <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        <span className="font-medium">Inserted but not part of basic info/year slabs:</span>{' '}
                        {insertedButNotInBasicInfo.map((item, index) => {
                          try {
                            let sNoObj;
                            if (typeof item === 'string') {
                              sNoObj = JSON.parse(item);
                            } else if (typeof item === 'object' && item.number) {
                              sNoObj = item;
                            } else {
                              // fallback for plain string numbers
                              return `${item} (S.No.)`;
                            }
                            
                            const typeDisplay = sNoObj.type === "s_no" ? "Survey" : 
                                              sNoObj.type === "block_no" ? "Block" : 
                                              sNoObj.type === "re_survey_no" ? "Re-survey" : "S.No.";
                            return `${sNoObj.number} (${typeDisplay})`;
                          } catch {
                            return `${item} (S.No.)`;
                          }
                        }).join(", ")}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Document Display */}
              {nondh.nondhDoc && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Nondh Document
                  </Label>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        {nondh.nondhDocFileName || 'Document uploaded'}
                      </p>
                      <p className="text-xs text-blue-700">Click on button to view document</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFileDownload(nondh.nondhDoc)}
                      className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </div>
                </div>
              )}

              {!nondh.nondhDoc && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Nondh Document
                  </Label>
                  <p className="text-sm text-gray-500 italic">No document uploaded</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  )
}