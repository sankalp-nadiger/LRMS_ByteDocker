"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle } from "lucide-react";

import LandBasicInfoComponent from "./land-basic-info";
import YearSlabs from "./year-slabs";
import Panipatrak from "./panipatrak";
import NondhAdd from "./nondh-add";
import NondhDetails from "./nondh-details";
import OutputViews from "./output-views";
interface FormStep {
  id: number;
  title: string;
  description: string;
}

export function LandFormsContainer() {
  const { currentStep, setCurrentStep } = useLandRecord();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const steps: FormStep[] = [
    {
      id: 1,
      title: "Land Basic Info",
      description: "District, Taluka, Village & Area details",
    },
    { id: 2, title: "Year Slabs", description: "Add year-wise land slabs" },
    {
      id: 3,
      title: "Panipatrak",
      description: "Add farmer details for each slab",
    },
    {
      id: 4,
      title: "Nondh Add",
      description: "Add Nondh numbers and affected S.no",
    },
    {
      id: 5,
      title: "Nondh Details",
      description: "Complete Nondh information",
    },
    {
      id: 6,
      title: "Output",
      description: "View results and generate reports",
    },
  ];

  // Sync local activeStep with context currentStep
  const [activeStep, setActiveStep] = useState(currentStep || 1);

  useEffect(() => {
    if (currentStep && currentStep !== activeStep) {
      setActiveStep(currentStep);
    }
  }, [currentStep, activeStep]);

  const handleStepChange = (stepId: number) => {
    setActiveStep(stepId);
    setCurrentStep(stepId);
  };

  const handleNext = () => {
    const currentIndex = steps.findIndex((step) => step.id === activeStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1].id;
      setActiveStep(nextStep);
      setCurrentStep(nextStep);
    }
  };

  const handlePrevious = () => {
    const currentIndex = steps.findIndex((step) => step.id === activeStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1].id;
      setActiveStep(prevStep);
      setCurrentStep(prevStep);
    }
  };

  const isLastStep = activeStep === steps[steps.length - 1].id;
  const isFirstStep = activeStep === steps[0].id;
  const progress = (activeStep / steps.length) * 100;

  const renderStep = () => {
    switch (activeStep) {
      case 1:
        return <LandBasicInfoComponent />;
      case 2:
        return <YearSlabs />;
      case 3:
        return <Panipatrak />;
      case 4:
        return <NondhAdd />;
      case 5:
        return <NondhDetails />;
      case 6:
        return <OutputViews />;
      default:
        return <LandBasicInfoComponent />;
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Step Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {steps.map((step) => (
              <Button
                key={step.id}
                variant={activeStep === step.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleStepChange(step.id)}
                className="flex items-center gap-2"
              >
                {completedSteps.has(step.id) || activeStep > step.id ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.id}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className="mb-6">{renderStep()}</div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstStep}
        >
          Previous
        </Button>

        <div className="flex gap-2">
          {isLastStep ? (
            <Button className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Submit All Forms
            </Button>
          ) : (
            <Button onClick={handleNext}>Next</Button>
          )}
        </div>
      </div>
    </div>
  );
}