"use client";
import { useEffect, useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, ChevronUp, ChevronDown } from "lucide-react";
import { useLandRecord } from "@/contexts/land-record-context";
import { LandRecordService } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { convertFromSquareMeters } from "@/lib/supabase";

type AreaUnit = "acre" | "sq_m";
type FarmerStrict = {
  id: string;
  name: string;
  area: { value: number; unit: AreaUnit };
  type: 'regular' | 'paiky' | 'ekatrikaran';
  paikyNumber?: number;
  ekatrikaranNumber?: number;
};

function getYearPeriods(startYear: number, endYear: number) {
  if (!startYear || !endYear) return [];
  
  const periods: { from: number; to: number; period: string }[] = [];
  for (let y = startYear; y < endYear; y++) {
    periods.push({ 
      from: y, 
      to: y + 1, 
      period: `${y}-${y + 1}` 
    });
  }
  return periods;
}

const FarmerCardView = ({
  farmer,
  farmerIdx,
  isSpecialType = false,
  slabEntryData
}: {
  farmer: FarmerStrict;
  farmerIdx: number;
  isSpecialType?: boolean;
  slabEntryData?: any;
}) => {
  const areaInSqM = farmer.area.unit === "sq_m" 
    ? farmer.area.value 
    : convertFromSquareMeters(farmer.area.value, "sq_m");
    
  const acres = convertFromSquareMeters(areaInSqM, "acre");
  const guntha = convertFromSquareMeters(areaInSqM, "guntha") % 40;

  return (
    <Card key={farmer.id} className="p-4 bg-gray-50">
      <div className="mb-3">
        <h4 className="font-medium text-md">
          {isSpecialType 
            ? `${farmer.type === 'paiky' ? 'Paiky' : 'Ekatrikaran'} ${farmer.paikyNumber || farmer.ekatrikaranNumber} - Farmer ${farmerIdx + 1}`
            : `Farmer ${farmerIdx + 1}`}
        </h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Farmer Name</Label>
          <p className="text-sm">{farmer.name}</p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Area (Sq. Meters)</Label>
              <p className="text-sm">{Math.round(areaInSqM * 100) / 100}</p>
            </div>
            <div className="space-y-2">
              <Label>Area (Acres-Guntha)</Label>
              <p className="text-sm">
                {Math.floor(acres)} acre {Math.round(guntha)} guntha
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function Panipatrak() {
  const { yearSlabs, recordId } = useLandRecord();
  const [loading, setLoading] = useState(true);
  const [expandedSlabs, setExpandedSlabs] = useState<Record<string, boolean>>({});
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({});
  const [panipatraks, setPanipatraks] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!recordId) return;
      
      try {
        setLoading(true);
        const { data, error } = await LandRecordService.getPanipatraks(recordId);
        
        if (error) throw error;
        
        setPanipatraks(data || []);
        
        // Initialize expanded states
        const initialExpanded: Record<string, boolean> = {};
        yearSlabs.forEach(slab => {
          initialExpanded[slab.id] = true;
        });
        setExpandedSlabs(initialExpanded);
        
      } catch (error) {
        toast({
          title: "Error loading panipatraks",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [recordId, yearSlabs]);

  const toggleSlab = (slabId: string) => {
    setExpandedSlabs(prev => ({
      ...prev,
      [slabId]: !prev[slabId]
    }));
  };

  const togglePeriod = (slabId: string, period: string) => {
    setExpandedPeriods(prev => ({
      ...prev,
      [`${slabId}-${period}`]: !prev[`${slabId}-${period}`]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading panipatraks...</p>
        </CardContent>
      </Card>
    );
  }

  if (!yearSlabs.length) {
    return <div className="p-10">No year slabs found</div>;
  }

  const getAllUniqueSlabNumbers = (slab: any) => {
    if ((slab.paiky || slab.ekatrikaran) && 
        ((slab.paikyEntries && slab.paikyEntries.length > 0) || 
         (slab.ekatrikaranEntries && slab.ekatrikaranEntries.length > 0))) {
      
      const allEntries = [
        ...(slab.paikyEntries || []),
        ...(slab.ekatrikaranEntries || [])
      ];
      
      const uniqueEntries = allEntries.reduce((acc: any, entry: any) => {
        const key = `${entry.sNoType}-${entry.sNo}`;
        if (!acc[key]) {
          acc[key] = {
            sNo: entry.sNo,
            sNoType: entry.sNoType
          };
        }
        return acc;
      }, {});
      
      return Object.values(uniqueEntries);
    } else {
      return [{
        sNo: slab.sNo,
        sNoType: slab.sNoType
      }];
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Panipatrak (Farmer Details)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {yearSlabs.map((slab) => {
          const slabPanipatraks = panipatraks.filter(p => p.slabId === slab.id);
          const periods = getYearPeriods(slab.startYear, slab.endYear);
          const hasPaiky = slab.paiky;
          const hasEkatrikaran = slab.ekatrikaran;
          
          // ⭐ Check if this slab has sameForAll set to true
          const hasSameForAll = slabPanipatraks.length > 0 && 
                                slabPanipatraks.every(p => p.sameForAll === true);

          return (
            <Card key={slab.id} className="mb-6 border-2 border-gray-200">
              <CardHeader className="bg-gray-50 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-bold text-lg">
                      Slab {slab.sNo}: {slab.startYear} - {slab.endYear}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {(() => {
                        const allNumbers = getAllUniqueSlabNumbers(slab);
                        if (allNumbers.length === 1) {
                          const entry = allNumbers[0];
                          return `${entry.sNoType === 'block_no' ? 'Block No' : 
                                   entry.sNoType === 're_survey_no' ? 'Re-survey No' : 'Survey No'}: ${entry.sNo}`;
                        } else {
                          const grouped = allNumbers.reduce((acc: any, entry: any) => {
                            const typeLabel = entry.sNoType === 'block_no' ? 'Block' : 
                                             entry.sNoType === 're_survey_no' ? 'Re-survey' : 'Survey';
                            if (!acc[typeLabel]) acc[typeLabel] = [];
                            acc[typeLabel].push(entry.sNo);
                            return acc;
                          }, {});
                          
                          return Object.entries(grouped)
                            .map(([type, numbers]: [string, any]) => `${type} No${numbers.length > 1 ? 's' : ''}: ${numbers.join(', ')}`)
                            .join(' | ');
                        }
                      })()}
                    </p>
                    {/* ⭐ Display "Same for all years" badge */}
                    {hasSameForAll && (
                      <p className="text-sm text-blue-600 font-medium mt-1">
                        ✓ Same for all years
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSlab(slab.id)}
                  >
                    {expandedSlabs[slab.id] ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              
              {expandedSlabs[slab.id] && (
                <CardContent className="space-y-6 p-4">
                  {hasSameForAll ? (
                    // ⭐ When sameForAll is true, show only the first period's data
                    (() => {
                      const firstPeriodData = slabPanipatraks.find(p => p.year === periods[0].from);
                      
                      if (!firstPeriodData) return null;

                      return (
                        <Card className="shadow-sm border">
                          <div 
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => togglePeriod(slab.id, 'all-years')}
                          >
                            <div>
                              <h3 className="font-semibold text-md">
                                All Years ({slab.startYear}-{slab.endYear})
                              </h3>
                              <p className="text-sm text-gray-500">
                                {firstPeriodData.farmers.length} farmer(s)
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                            >
                              {expandedPeriods[`${slab.id}-all-years`] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          
                          {expandedPeriods[`${slab.id}-all-years`] && (
                            <div className="p-4 space-y-4">
                              {hasPaiky && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Paikies</h3>
                                  {firstPeriodData.farmers
                                    .filter(f => f.type === 'paiky')
                                    .map((farmer, idx) => (
                                      <FarmerCardView
                                        key={farmer.id}
                                        farmer={farmer}
                                        farmerIdx={idx}
                                        isSpecialType={true}
                                      />
                                    ))}
                                </div>
                              )}
                              
                              {hasEkatrikaran && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Ekatrikarans</h3>
                                  {firstPeriodData.farmers
                                    .filter(f => f.type === 'ekatrikaran')
                                    .map((farmer, idx) => (
                                      <FarmerCardView
                                        key={farmer.id}
                                        farmer={farmer}
                                        farmerIdx={idx}
                                        isSpecialType={true}
                                      />
                                    ))}
                                </div>
                              )}
                              
                              {!hasPaiky && !hasEkatrikaran && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Farmers</h3>
                                  {firstPeriodData.farmers.map((farmer, idx) => (
                                    <FarmerCardView
                                      key={farmer.id}
                                      farmer={farmer}
                                      farmerIdx={idx}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })()
                  ) : (
                    // ⭐ Normal case - show all periods separately
                    periods.map((period) => {
                      const periodData = slabPanipatraks.find(p => p.year === period.from);
                      
                      if (!periodData) return null;

                      return (
                        <Card key={`${slab.id}-${period.period}`} className="shadow-sm border">
                          <div 
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => togglePeriod(slab.id, period.period)}
                          >
                            <div>
                              <h3 className="font-semibold text-md">
                                {period.period}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {periodData.farmers.length} farmer(s)
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                            >
                              {expandedPeriods[`${slab.id}-${period.period}`] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          
                          {expandedPeriods[`${slab.id}-${period.period}`] && (
                            <div className="p-4 space-y-4">
                              {hasPaiky && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Paikies</h3>
                                  {periodData.farmers
                                    .filter(f => f.type === 'paiky')
                                    .map((farmer, idx) => (
                                      <FarmerCardView
                                        key={farmer.id}
                                        farmer={farmer}
                                        farmerIdx={idx}
                                        isSpecialType={true}
                                      />
                                    ))}
                                </div>
                              )}
                              
                              {hasEkatrikaran && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Ekatrikarans</h3>
                                  {periodData.farmers
                                    .filter(f => f.type === 'ekatrikaran')
                                    .map((farmer, idx) => (
                                      <FarmerCardView
                                        key={farmer.id}
                                        farmer={farmer}
                                        farmerIdx={idx}
                                        isSpecialType={true}
                                      />
                                    ))}
                                </div>
                              )}
                              
                              {!hasPaiky && !hasEkatrikaran && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Farmers</h3>
                                  {periodData.farmers.map((farmer, idx) => (
                                    <FarmerCardView
                                      key={farmer.id}
                                      farmer={farmer}
                                      farmerIdx={idx}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}