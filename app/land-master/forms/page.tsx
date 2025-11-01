"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LandFormsContainer } from "@/components/forms/land-forms-container";
import { ViewFormsContainer } from "@/components/view/land-forms-container";
import { EditFormsContainer } from "@/components/edit/land-forms-container";
import { LandRecordProvider } from "@/contexts/land-record-context";
import { useSearchParams } from "next/navigation";

export default function LandFormsPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'add'; // Changed from 'type' to 'mode'
  const id = searchParams.get('id') || undefined; // Explicit undefined for provider
  const router = useRouter();
    console.log('LandFormsPage rendered');
  console.log('Mode:', mode);
  console.log('ID:', id);
  console.log('Search params:', Object.fromEntries(searchParams.entries()));

  return (
    <LandRecordProvider mode={mode as 'view' | 'edit' | 'add'} recordId={id}>
      <div className="min-h-screen bg-background">
        
        {/* Header */}
        <div className="border-b">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => router.push('/land-master')}
    className="gap-2"
  >
    <ArrowLeft className="h-4 w-4" />
    <span className="hidden sm:inline">Back to Land Master</span>
  </Button>
  <div>
                <h1 className="text-2xl font-bold">
                  {mode === 'add' && 'Add New Land'}
                  {mode === 'view' && 'View Land Record'}
                  {mode === 'edit' && 'Edit Land Record'}
                </h1>
                <CardDescription className="mt-1">
                  {mode === 'add' && 'Complete the land registration forms'}
                  {mode === 'view' && 'View land record details'}
                  {mode === 'edit' && 'Edit land record details'}
                </CardDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Forms Content */}
        <div className="container mx-auto px-6 py-6">
          <Card>
            <CardContent className="p-6">
              {mode === 'view' && (
                <>
                  {console.log('Rendering ViewFormsContainer')}
                  <ViewFormsContainer />
                </>
              )}
              {mode === 'edit' && (
                <>
                  {console.log('Rendering EditFormsContainer')}
                  <EditFormsContainer />
                </>
              )}
              {mode === 'add' && <LandFormsContainer />}
            </CardContent>
          </Card>
        </div>
      </div>
    </LandRecordProvider>
  );
}