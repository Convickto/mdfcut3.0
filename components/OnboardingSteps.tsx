import React from 'react';
import Button from './Button';
import { OVERLAY_COLOR } from '../constants';

interface OnboardingStepsProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  title: string;
  description: string;
  className?: string;
}

const OnboardingSteps: React.FC<OnboardingStepsProps> = ({
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  title,
  description,
  className = '',
}) => {
  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${className}`}
      style={{ backgroundColor: OVERLAY_COLOR }}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-gray-700 mb-6">{description}</p>
        <div className="flex justify-center mb-6">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <span
              key={index}
              className={`block w-3 h-3 mx-1 rounded-full ${
                index + 1 === currentStep ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            ></span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          {currentStep < totalSteps ? (
            <Button onClick={onNext} variant="primary" size="lg" className="w-full sm:w-auto">
              Próximo Passo ({currentStep}/{totalSteps})
            </Button>
          ) : (
            <Button onClick={onNext} variant="primary" size="lg" className="w-full sm:w-auto">
              Começar
            </Button>
          )}
          <Button onClick={onSkip} variant="outline" size="lg" className="w-full sm:w-auto">
            Pular Tutorial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSteps;
