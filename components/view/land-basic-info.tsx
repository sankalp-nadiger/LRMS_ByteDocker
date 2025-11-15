"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Download, Eye, FileText } from "lucide-react"
import { useLandRecord } from "@/contexts/land-record-context"
import { isPromulgation } from "@/lib/mock-data"
import { LandRecordService } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { LandBasicInfo } from "@/contexts/land-record-context"

export default function LandBasicInfoComponent() {
  const { recordId } = useLandRecord()
  const { toast } = useToast()
  
  const [landData, setLandData] = useState<LandBasicInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch land record data
useEffect(() => {
  const fetchLandRecord = async () => {
    if (!recordId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await LandRecordService.getLandRecord(recordId)
      
      if (error) throw error
      
      if (data) {
        // Check promulgation status from mock data
        const isProm = isPromulgation(data.district, data.taluka, data.village)
        
        const mappedData: LandBasicInfo = {
          id: data.id,
          district: data.district || "",
          taluka: data.taluka || "",
          village: data.village || "",
          area: { 
            value: data.area_value || 0, 
            unit: data.area_unit || "sq_m",
            acres: data.area_unit === 'acre' ? data.area_value : undefined,
            gunthas: data.area_unit === 'guntha' ? data.area_value : undefined,
            square_meters: data.area_unit === 'sq_m' ? data.area_value : undefined
          },
          sNoType: data.s_no_type || "s_no",
          sNo: data.s_no || "",
          isPromulgation: isProm, // Use calculated value from mock data
          blockNo: data.block_no || "",
          reSurveyNo: data.re_survey_no || "",
          integrated712: data.integrated_712 || "",
          integrated712FileName: data.integrated_712_filename || ""
        }
        setLandData(mappedData)
      }
    } catch (error) {
      console.error('Error fetching land record:', error)
      toast({ 
        title: "Error loading land record", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  fetchLandRecord()
}, [recordId, toast])

  const handleFileDownload = () => {
    if (landData?.integrated712) {
      window.open(landData.integrated712, '_blank')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Land Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading land record...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!landData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Land Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <p className="text-muted-foreground">No land record found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Land Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">District</Label>
            <p className="text-base font-semibold">{landData.district}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Taluka</Label>
            <p className="text-base font-semibold">{landData.taluka}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Village</Label>
            <p className="text-base font-semibold">{landData.village}</p>
          </div>
        </div>

{/* Area Display */}
<div className="space-y-2">
  <Label className="text-sm font-medium text-muted-foreground">Land Area</Label>
  <div className="flex items-center gap-4">
    <p className="text-base font-semibold">
      {landData.area.value} {landData.area.unit === 'sq_m' ? 'sq meters' : landData.area.unit}
    </p>
  </div>
</div>

        {/* Survey Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Block Number</Label>
            <p className="text-base font-semibold">{landData.blockNo}</p>
          </div>
        </div>

        {/* Promulgation Status */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Promulgation Status</Label>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                landData.isPromulgation 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {landData.isPromulgation ? "Yes" : "No"}
              </span>
            </div>
          </div>
          
          {landData.isPromulgation && landData.reSurveyNo && (
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Re Survey Number</Label>
              <p className="text-base font-semibold">{landData.reSurveyNo}</p>
            </div>
          )}
        </div>

        {/* Document Display */}
        {landData.integrated712 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Integrated 7/12 Document</Label>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  {landData.integrated712FileName || 'Document uploaded'}
                </p>
                <p className="text-xs text-blue-700">Click on button to view document</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFileDownload}
                className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <Eye className="w-4 h-4" />
                View
              </Button>
            </div>
          </div>
        )}

        {!landData.integrated712 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Integrated 7/12 Document</Label>
            <p className="text-sm text-gray-500 italic">No document uploaded</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}