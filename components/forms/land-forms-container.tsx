"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { useLandRecord } from "@/contexts/land-record-context";
import { LandRecordService } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useStepFormData } from "@/hooks/use-step-form-data";

// Import your form components
import LandBasicInfoComponent from "./land-basic-info";
import YearSlabs from "./year-slabs";
import Panipatrak from "./panipatrak";
import NondhAdd from "./nondh-add";
import NondhDetails from "./nondh-details";
import OutputViews from "./output-views";
import { AuthProvider } from "@/components/auth-provider"

interface FormStep {
  id: number;
  title: string;
  description: string;
  shortTitle?: string; // For mobile display
}

export function LandFormsContainer() {
  const {
    currentStep,
    setCurrentStep,
    landBasicInfo,
    hasUnsavedChanges,
    formData,
    setFormData,
  } = useLandRecord();
  const { toast } = useToast();

  // Get current step form data handler
  const currentStepFormData = useStepFormData(currentStep);

  const [activeStep, setActiveStep] = useState(currentStep);
  const [isSaving, setIsSaving] = useState(false);

  const steps: FormStep[] = [
    {
      id: 1,
      title: "Land Basic Info",
      shortTitle: "Basic Info",
      description: "District, Taluka, Village & Area details",
    },
    { 
      id: 2, 
      title: "Year Slabs", 
      shortTitle: "Slabs",
      description: "Add year-wise land slabs" 
    },
    {
      id: 3,
      title: "Panipatrak",
      shortTitle: "Panipatrak",
      description: "Add farmer details for each slab",
    },
    {
      id: 4,
      title: "Nondh Add",
      shortTitle: "Nondh Add",
      description: "Add Nondh numbers and affected S.no",
    },
    {
      id: 5,
      title: "Nondh Details",
      shortTitle: "Details",
      description: "Complete Nondh information",
    },
    {
      id: 6,
      title: "Output",
      shortTitle: "Output",
      description: "View results and generate reports",
    },
  ];

  // Memoize steps to prevent unnecessary re-renders
  const stepsMap = useMemo(() => {
    return new Map(steps.map(step => [step.id, step]));
  }, []);

  // Sync active step with context
  useEffect(() => {
    setActiveStep(currentStep);
  }, [currentStep]);

  // Handle step changes
  const handleStepChange = useCallback(async (newStep: number) => {
    // No dialog box, just proceed directly
    setActiveStep(newStep);
    setCurrentStep(newStep);
    return true;
  }, [setCurrentStep]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    const currentIndex = steps.findIndex((step) => step.id === activeStep);
    if (currentIndex < steps.length - 1) {
      await handleStepChange(steps[currentIndex + 1].id);
    }
  }, [activeStep, handleStepChange, steps]);

  const handlePrevious = useCallback(async () => {
    const currentIndex = steps.findIndex((step) => step.id === activeStep);
    if (currentIndex > 0) {
      await handleStepChange(steps[currentIndex - 1].id);
    }
  }, [activeStep, handleStepChange, steps]);

  const handleSubmitAll = useCallback(async () => {
    setIsSaving(true);
    try {
      const combinedData = {
        ...formData,
        current_step: activeStep,
        status: "completed",
      };

      const { data, error } = await LandRecordService.saveLandRecord(combinedData);
      if (error) throw error;
      
      // Mark all steps as saved
      steps.forEach(step => {
        const stepFormData = useStepFormData(step.id);
        stepFormData.markAsSaved();
      });
      
      toast({ title: "All forms submitted successfully!" });
      localStorage.setItem("currentLandRecordId", data.id);
    } catch (error) {
      console.error(error);
      toast({ title: "Error submitting forms", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [activeStep, formData, steps, toast]);

  // Render current step with its saved data
  const renderStep = useCallback(() => {
    const stepData = formData[activeStep] || {};
    
    switch (activeStep) {
      case 1: 
        return <LandBasicInfoComponent data={stepData.landBasicInfo} />;
      case 2: 
        return <YearSlabs data={stepData.yearSlabs} />;
      case 3: 
        return <Panipatrak data={stepData.panipatrak} />;
      case 4: 
        return <NondhAdd data={stepData.nondhAdd} />;
      case 5: 
        return <NondhDetails data={stepData.nondhDetails} />;
      case 6: 
        return <OutputViews data={stepData.outputViews} />;
      default: 
        return <LandBasicInfoComponent />;
    }
  }, [activeStep, formData]);

  const isLastStep = activeStep === steps[steps.length - 1].id;
  const isFirstStep = activeStep === steps[0].id;
  const progress = (activeStep / steps.length) * 100;

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50/50 p-2 sm:p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          {/* Progress Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                Land Record Management System (LRMS)
              </CardTitle>
              <div className="mt-4">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Step {activeStep} of {steps.length}
                </p>
              </div>
            </CardHeader>
          </Card>

          {/* Responsive Step Navigation */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              {/* Mobile Step Navigation - Horizontal Scroll */}
              <div className="sm:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={activeStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-1 whitespace-nowrap flex-shrink-0 min-w-fit"
                    >
                      {activeStep > step.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Circle className="w-3 h-3" />
                      )}
                      <span className="text-xs">{step.id}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tablet and Desktop Step Navigation */}
              <div className="hidden sm:block">
                {/* Tablet - 2 rows */}
                <div className="sm:grid sm:grid-cols-3 lg:hidden gap-2">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={activeStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-2 w-full"
                    >
                      {activeStep > step.id ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span className="text-sm truncate">{step.shortTitle || step.title}</span>
                    </Button>
                  ))}
                </div>

                {/* Desktop - Single row */}
                <div className="hidden lg:flex lg:flex-wrap lg:gap-2 lg:justify-center">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={activeStep === step.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      {activeStep > step.id ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                      <span>{step.title}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Step Content - Responsive Container */}
          <div className="w-full">
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
              {renderStep()}
            </div>
          </div>

          {/* Responsive Navigation Buttons */}
          <Card className="shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isFirstStep || isSaving}
                  className="order-2 sm:order-1"
                >
                  Previous
                </Button>

                <div className="flex gap-2 order-1 sm:order-2">
                  {isLastStep ? (
                    <Button
                      onClick={handleSubmitAll}
                      disabled={isSaving}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Submit All Forms
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleNext} 
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthProvider>
  );
}